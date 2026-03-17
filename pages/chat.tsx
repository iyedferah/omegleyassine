import React, { useEffect, useRef, useState, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import VideoPanel from '../components/VideoPanel'
import ChatBox, { type Message } from '../components/ChatBox'
import ChatInput from '../components/ChatInput'
import ControlBar from '../components/ControlBar'
import WaitingScreen from '../components/WaitingScreen'

type ChatStatus = 'initializing' | 'waiting' | 'chatting' | 'disconnected'

export default function ChatPage() {
  const router = useRouter()
  const { mode: modeParam, interests: interestsParam } = router.query as {
    mode?: string
    interests?: string
  }

  const mode = (modeParam === 'text' ? 'text' : 'video') as 'video' | 'text'
  const interests = interestsParam ? interestsParam.split(',') : []

  // ─── Refs (don't trigger re-renders) ─────────────────────────────────────
  const socketRef = useRef<any>(null)
  const peerRef = useRef<any>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const currentRoomRef = useRef<string | null>(null)
  const signalBufferRef = useRef<any[]>([])
  const iceServersRef = useRef<any[]>([
    // Fallback STUN — used until TURN credentials are fetched
    { urls: 'stun:stun.l.google.com:19302' },
  ])

  // ─── State ────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<ChatStatus>('initializing')
  const [messages, setMessages] = useState<Message[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [onlineCount, setOnlineCount] = useState(0)
  const [isRouterReady, setIsRouterReady] = useState(false)

  // ─── Wait for router ──────────────────────────────────────────────────────
  useEffect(() => {
    if (router.isReady) setIsRouterReady(true)
  }, [router.isReady])

  // ─── Destroy Peer ─────────────────────────────────────────────────────────
  const destroyPeer = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy()
      peerRef.current = null
    }
    setRemoteStream(null)
    signalBufferRef.current = []
  }, [])

  // ─── Leave current room (for Next button or cleanup) ──────────────────────
  const leaveRoom = useCallback(() => {
    if (currentRoomRef.current) {
      socketRef.current?.emit('leave-room')
      currentRoomRef.current = null
    }
    destroyPeer()
  }, [destroyPeer])

  // ─── Create WebRTC Peer ───────────────────────────────────────────────────
  const createPeer = useCallback(async (initiator: boolean, roomId: string) => {
    destroyPeer()

    // Dynamic import — avoids SSR crash since simple-peer uses `window`
    const { default: Peer } = await import('simple-peer')

    const peer = new (Peer as any)({
      initiator,
      trickle: true,
      stream: localStreamRef.current || undefined,
      config: {
        iceServers: iceServersRef.current,
      },
    })

    peer.on('signal', (signal: any) => {
      socketRef.current?.emit('signal', { roomId, signal })
    })

    peer.on('stream', (stream: MediaStream) => {
      setRemoteStream(stream)
    })

    peer.on('error', (err: Error) => {
      console.error('[webrtc] Peer error:', err.message)
      // Don't auto-reconnect on error — partner may have left intentionally
    })

    peer.on('close', () => {
      setRemoteStream(null)
    })

    // Monitor the underlying RTCPeerConnection so we can detect network drops
    // simple-peer exposes it as peer._pc
    peer.on('connect', () => {
      console.log('[webrtc] P2P connection established!')
    })

    // Watch ICE state to detect mid-call drops
    setTimeout(() => {
      const pc: RTCPeerConnection | undefined = (peer as any)._pc
      if (!pc) return
      pc.oniceconnectionstatechange = () => {
        console.log('[webrtc] ICE state:', pc.iceConnectionState)
        if (pc.iceConnectionState === 'disconnected') {
          // Give it 5s to recover before declaring failure
          console.warn('[webrtc] ICE disconnected — waiting to see if it recovers...')
        }
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
          console.error('[webrtc] ICE failed/closed — connection dropped')
          setRemoteStream(null)
        }
      }
    }, 500) // short delay so _pc is set up by simple-peer

    // Process buffered signals
    peerRef.current = peer
    if (signalBufferRef.current.length > 0) {
      signalBufferRef.current.forEach(sig => peer.signal(sig))
      signalBufferRef.current = []
    }
  }, [destroyPeer])

  // ─── Join the matchmaking queue ───────────────────────────────────────────
  const joinQueue = useCallback(() => {
    setMessages([])
    setStatus('waiting')
    socketRef.current?.emit('join-queue', { mode, interests })
  }, [mode, interests])

  // ─── Setup socket events ───────────────────────────────────────────────────
  const setupSocketEvents = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return

    // Remove old listeners before adding new (prevent duplicates on re-queue)
    socket.off('waiting').off('matched').off('signal').off('chat-message').off('partner-left').off('stats')

    socket.on('waiting', () => setStatus('waiting'))

    socket.on('matched', ({ roomId, initiator }: { roomId: string; initiator: boolean }) => {
      currentRoomRef.current = roomId
      setStatus('chatting')
      setMessages([{ text: "You're now connected with a stranger. Say hi!", from: 'system' }])
      createPeer(initiator, roomId)
    })

    socket.on('signal', ({ signal }: { signal: any }) => {
      if (peerRef.current) {
        peerRef.current.signal(signal)
      } else {
        signalBufferRef.current.push(signal)
      }
    })

    socket.on('chat-message', ({ text }: { text: string }) => {
      setMessages(prev => [...prev, { text, from: 'stranger' }])
    })

    socket.on('partner-left', () => {
      destroyPeer()
      currentRoomRef.current = null
      setStatus('disconnected')
      setMessages(prev => [...prev, { text: 'Stranger has disconnected.', from: 'system' }])
    })

    socket.on('stats', ({ online }: { online: number }) => {
      setOnlineCount(online)
    })

    // ── Handle socket reconnect (Railway restart / network blip) ──────────────
    socket.on('reconnect', () => {
      console.log('[socket] Reconnected — rejoining queue')
      // If we were waiting or chatting, go back to waiting after reconnect
      if (status === 'waiting' || status === 'chatting') {
        destroyPeer()
        currentRoomRef.current = null
        setStatus('waiting')
        socket.emit('join-queue', { mode, interests })
      }
    })

  }, [createPeer, destroyPeer, mode, interests, status])

  // ─── Bootstrap on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isRouterReady) return

    let cancelled = false

    const bootstrap = async () => {
      // 0. Fetch TURN credentials from our own API route (server-side, secure & reliable)
      try {
        const res = await fetch('/api/ice-servers')
        if (res.ok) {
          const servers = await res.json()
          if (Array.isArray(servers) && servers.length > 0) {
            iceServersRef.current = servers
          }
        }
      } catch (e) {
        console.warn('[turn] Could not fetch TURN credentials, using STUN fallback')
      }

      // 1. Get socket
      const { getSocket } = await import('../lib/socket')
      const socket = getSocket()
      socketRef.current = socket

      // 2. Get camera/mic (video mode only)
      if (mode === 'video') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
          if (!cancelled) {
            localStreamRef.current = stream
            setLocalStream(stream)  // triggers re-render so preview shows immediately
          }
        } catch (err) {
          console.warn('[media] Could not get user media:', err)
          localStreamRef.current = null
          setLocalStream(null)
        }
      }

      if (cancelled) return

      // 3. Wire up socket events
      setupSocketEvents()

      // 4. Join queue
      socket.emit('get-stats')
      joinQueue()
    }

    bootstrap()

    return () => {
      cancelled = true
      leaveRoom()
      localStreamRef.current?.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
  }, [isRouterReady, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    leaveRoom()
    setupSocketEvents()
    joinQueue()
  }, [leaveRoom, setupSocketEvents, joinQueue])

  const handleStop = useCallback(() => {
    leaveRoom()
    socketRef.current?.emit('leave-queue')
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
    router.push('/')
  }, [leaveRoom, router])

  const handleSendMessage = useCallback((text: string) => {
    const roomId = currentRoomRef.current
    if (!roomId) return
    socketRef.current?.emit('chat-message', { roomId, text })
    setMessages(prev => [...prev, { text, from: 'me' }])
  }, [])

  const handleToggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
      setIsMuted(prev => !prev)
    }
  }, [])

  const handleToggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
      setIsCameraOff(prev => !prev)
    }
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  const isChatting = status === 'chatting'
  const isWaiting = status === 'waiting' || status === 'initializing'

  return (
    <>
      <Head>
        <title>OmegleCams — Chatting</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: '#09090b',
        overflow: 'hidden',
      }}>
        {/* ── Top bar ───────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#18181b',
          borderBottom: '1px solid #27272a',
          flexShrink: 0,
        }}>
          {/* Logo */}
          <span
            onClick={() => router.push('/')}
            style={{
              fontWeight: 900, fontSize: 18, letterSpacing: '-0.03em',
              background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', cursor: 'pointer',
            }}
          >
            OmegleCams
          </span>

          {/* Status pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            background: isChatting ? '#14532d' : isWaiting ? '#1e3a5f' : '#3f1515',
            border: `1px solid ${isChatting ? '#166534' : isWaiting ? '#1d4ed8' : '#6b2020'}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isChatting ? '#22c55e' : isWaiting ? '#60a5fa' : '#ef4444',
            }} />
            <span style={{ color: '#e4e4e7', fontSize: 12, fontWeight: 600 }}>
              {isChatting ? 'Connected' : isWaiting ? 'Finding...' : 'Disconnected'}
            </span>
          </div>

          {/* Online count */}
          {onlineCount > 0 && (
            <span style={{ color: '#52525b', fontSize: 12 }}>
              {onlineCount.toLocaleString()} online
            </span>
          )}
        </div>

        {/* ── Main content area ─────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          // On small screens: stack vertically; on md+: side by side
        }}>
          {/* Left: Video panel (always renders in video mode so local cam preview shows) */}
          {mode === 'video' && (
            <div style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              position: 'relative',
            }}>
              {/* VideoPanel always rendered so camera preview shows while waiting */}
              <VideoPanel
                localStream={localStream}
                remoteStream={remoteStream}
                isCameraOff={isCameraOff}
                mode={mode}
              />
              {/* WaitingScreen overlaid on top during search */}
              {isWaiting && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(9,9,11,0.82)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10,
                }}>
                  <WaitingScreen onlineCount={onlineCount} mode={mode} />
                </div>
              )}
            </div>
          )}

          {/* Right: Chat panel */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: mode === 'text' ? '100%' : 'min(380px, 40%)',
            flexShrink: 0,
            borderLeft: mode === 'video' ? '1px solid #27272a' : 'none',
            background: '#18181b',
          }}>
            {/* Messages or waiting */}
            {mode === 'text' && isWaiting ? (
              <div style={{ flex: 1 }}>
                <WaitingScreen onlineCount={onlineCount} mode={mode} />
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <ChatBox messages={messages} />
              </div>
            )}

            {/* Input */}
            <ChatInput
              onSend={handleSendMessage}
              disabled={!isChatting}
            />
          </div>
        </div>

        {/* ── Control bar ───────────────────────────────────────────────────── */}
        <ControlBar
          status={status}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          mode={mode}
          onNext={handleNext}
          onStop={handleStop}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
        />
      </div>
    </>
  )
}
