import React, { useRef, useEffect } from 'react'

interface VideoPanelProps {
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isCameraOff: boolean
  mode: 'video' | 'text'
}

export default function VideoPanel({ localStream, remoteStream, isCameraOff, mode }: VideoPanelProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  if (mode === 'text') return null

  return (
    <div className="relative w-full h-full bg-zinc-950 rounded-2xl overflow-hidden">
      {/* Remote video (large, fills container) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover fade-in ${!remoteStream ? 'opacity-0' : 'opacity-100'}`}
        style={{ transition: 'opacity 0.3s ease' }}
      />

      {/* Placeholder when no remote stream */}
      {!remoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">Waiting for video...</p>
        </div>
      )}

      {/* Local video (small overlay, bottom-right) */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        width: 120, height: 80,
        borderRadius: 10, overflow: 'hidden',
        border: '2px solid #3f3f46',
        background: '#09090b',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}>
        {isCameraOff ? (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#27272a'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5">
              <path d="M3 3l18 18M10 10a4 4 0 006 6" />
              <path d="M21 9l-6 3 6 3V9z" />
              <path d="M3 9h10v6H3z" />
            </svg>
          </div>
        ) : (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        )}
      </div>

      {/* You label */}
      <div style={{
        position: 'absolute', bottom: 16, right: 138,
        fontSize: 11, color: '#a1a1aa', fontWeight: 600, letterSpacing: '0.05em',
        textShadow: '0 1px 4px rgba(0,0,0,0.8)'
      }}>
        YOU
      </div>
    </div>
  )
}
