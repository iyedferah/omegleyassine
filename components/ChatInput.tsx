import React, { useState, useRef } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '12px 12px',
      borderTop: '1px solid #27272a',
      background: '#18181b',
    }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Find a stranger to start chatting...' : 'Say something...'}
        maxLength={500}
        style={{
          flex: 1,
          background: '#27272a',
          border: '1px solid #3f3f46',
          borderRadius: 999,
          padding: '10px 16px',
          color: '#fff',
          fontSize: 14,
          outline: 'none',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = '#2563eb' }}
        onBlur={e => { e.target.style.borderColor = '#3f3f46' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        style={{
          background: '#2563eb',
          border: 'none',
          borderRadius: '50%',
          width: 40, height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: disabled || !text.trim() ? 'not-allowed' : 'pointer',
          opacity: disabled || !text.trim() ? 0.4 : 1,
          flexShrink: 0,
          transition: 'background 0.15s, transform 0.1s',
        }}
        onMouseEnter={e => { if (!disabled && text.trim()) (e.currentTarget as HTMLButtonElement).style.background = '#3b82f6' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2563eb' }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)' }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
        aria-label="Send message"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
        </svg>
      </button>
    </div>
  )
}
