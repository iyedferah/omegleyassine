import React, { useEffect, useState, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<'video' | 'text'>('video')
  const [interests, setInterests] = useState('')
  const [onlineCount, setOnlineCount] = useState(0)
  const socketRef = useRef<any>(null)

  // Connect socket just to get online count
  useEffect(() => {
    const { getSocket } = require('../lib/socket')
    const socket = getSocket()
    socketRef.current = socket

    socket.emit('get-stats')
    socket.on('stats', ({ online }: { online: number }) => {
      setOnlineCount(online)
    })

    // Refresh count every 10s
    const interval = setInterval(() => socket.emit('get-stats'), 10_000)
    return () => {
      clearInterval(interval)
      socket.off('stats')
    }
  }, [])

  const handleStart = () => {
    const interestList = interests
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)

    const params = new URLSearchParams({ mode })
    if (interestList.length > 0) {
      params.set('interests', interestList.join(','))
    }
    router.push(`/chat?${params.toString()}`)
  }

  return (
    <>
      <Head>
        <title>OmegleCams — Talk to Strangers!</title>
        <meta name="description" content="Video chat with random strangers online. Free, instant, no signup." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #1c1917 100%)',
        padding: '24px 16px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            lineHeight: 1.1,
            marginBottom: 8,
          }}>
            OmegleCams
          </h1>
          <p style={{ color: '#71717a', fontSize: '1.1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Talk to Strangers!
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: 20,
          padding: '32px 28px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}>
          {/* Mode toggle */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Chat Mode
            </label>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 8, background: '#09090b', borderRadius: 12, padding: 4,
            }}>
              {(['video', 'text'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '10px 0',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: '0.04em',
                    background: mode === m ? '#2563eb' : 'transparent',
                    color: mode === m ? '#fff' : '#71717a',
                    transition: 'all 0.18s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}
                >
                  {m === 'video' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  )}
                  {m === 'video' ? 'Video' : 'Text'}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Interests <span style={{ color: '#3f3f46', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={interests}
              onChange={e => setInterests(e.target.value)}
              placeholder="gaming, music, coding..."
              style={{
                width: '100%',
                background: '#09090b',
                border: '1px solid #27272a',
                borderRadius: 10,
                padding: '11px 14px',
                color: '#e4e4e7',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#2563eb' }}
              onBlur={e => { e.target.style.borderColor = '#27272a' }}
              onKeyDown={e => { if (e.key === 'Enter') handleStart() }}
            />
            <p style={{ color: '#52525b', fontSize: 12, marginTop: 5 }}>
              Comma-separated. We'll try to match you with similar interests.
            </p>
          </div>

          {/* Start button */}
          <button
            onClick={handleStart}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(37, 99, 235, 0.35)',
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.transform = 'translateY(-1px)'
              el.style.boxShadow = '0 8px 28px rgba(37, 99, 235, 0.5)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = '0 4px 20px rgba(37, 99, 235, 0.35)'
            }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
          >
            Start Chatting →
          </button>
        </div>

        {/* Online counter */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 8px #22c55e',
          }} />
          <span style={{ color: '#52525b', fontSize: 13 }}>
            {onlineCount > 0 ? `${onlineCount.toLocaleString()} people online` : 'Connecting...'}
          </span>
        </div>

        {/* Footer */}
        <p style={{ marginTop: 32, color: '#3f3f46', fontSize: 12, textAlign: 'center' }}>
          By using this service you agree to our terms. Be respectful.
        </p>
      </div>
    </>
  )
}
