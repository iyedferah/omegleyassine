import React from 'react'

interface ControlBarProps {
  status: 'initializing' | 'waiting' | 'chatting' | 'disconnected'
  isMuted: boolean
  isCameraOff: boolean
  mode: 'video' | 'text'
  onNext: () => void
  onStop: () => void
  onToggleMute: () => void
  onToggleCamera: () => void
}

const Btn = ({
  onClick, disabled = false, danger = false, primary = false, children, title
}: {
  onClick: () => void, disabled?: boolean, danger?: boolean,
  primary?: boolean, children: React.ReactNode, title?: string
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      padding: '9px 18px',
      borderRadius: 999,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: '0.04em',
      background: danger ? '#dc2626' : primary ? '#2563eb' : '#27272a',
      color: '#fff',
      opacity: disabled ? 0.45 : 1,
      transition: 'background 0.15s, transform 0.1s, opacity 0.15s',
      whiteSpace: 'nowrap',
      userSelect: 'none',
    }}
    onMouseEnter={e => {
      if (!disabled) {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = danger ? '#ef4444' : primary ? '#3b82f6' : '#3f3f46'
      }
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLButtonElement
      el.style.background = danger ? '#dc2626' : primary ? '#2563eb' : '#27272a'
    }}
    onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.94)' }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
  >
    {children}
  </button>
)

export default function ControlBar({
  status, isMuted, isCameraOff, mode,
  onNext, onStop, onToggleMute, onToggleCamera
}: ControlBarProps) {
  const isChatting = status === 'chatting'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: '12px 16px',
      background: '#09090b',
      borderTop: '1px solid #27272a',
      flexWrap: 'wrap',
    }}>
      {/* Media controls — only shown in video mode */}
      {mode === 'video' && (
        <>
          <Btn onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
            {isMuted ? 'Unmute' : 'Mute'}
          </Btn>

          <Btn onClick={onToggleCamera} title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}>
            {isCameraOff ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l22 22M17 17H3a2 2 0 01-2-2V7a2 2 0 012-2h3" />
                <path d="M21 15V9a2 2 0 00-2-2h-.34" />
                <path d="M11 3.34A4 4 0 0115 7v.34" />
                <polygon points="23 7 16 12 23 17 23 7" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            )}
            {isCameraOff ? 'Camera On' : 'Camera Off'}
          </Btn>
        </>
      )}

      {/* NEXT */}
      <Btn onClick={onNext} primary>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        Next
      </Btn>

      {/* STOP */}
      <Btn onClick={onStop} danger>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
        Stop
      </Btn>
    </div>
  )
}
