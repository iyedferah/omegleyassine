import React from 'react'

interface WaitingScreenProps {
  onlineCount: number
  mode: 'video' | 'text'
}

export default function WaitingScreen({ onlineCount, mode }: WaitingScreenProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', gap: 20,
      background: '#09090b',
    }}>
      {/* Pulse animation */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div className="pulse-ring" style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '2px solid #2563eb',
          opacity: 0.4,
        }} />
        <div style={{
          position: 'absolute', inset: 8,
          borderRadius: '50%',
          background: '#1e3a5f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {mode === 'video' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          )}
        </div>
      </div>

      <p style={{ color: '#e4e4e7', fontSize: 16, fontWeight: 600 }}>
        Looking for a stranger…
      </p>
      <p style={{ color: '#71717a', fontSize: 13 }}>
        This may take a few seconds
      </p>

      {onlineCount > 0 && (
        <div style={{
          marginTop: 8,
          padding: '6px 16px',
          borderRadius: 999,
          background: '#1c1c1e',
          border: '1px solid #27272a',
          color: '#a1a1aa',
          fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            boxShadow: '0 0 6px #22c55e'
          }} />
          {onlineCount.toLocaleString()} online
        </div>
      )}
    </div>
  )
}
