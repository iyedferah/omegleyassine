import React, { useEffect, useRef } from 'react'

export interface Message {
  text: string
  from: 'me' | 'stranger' | 'system'
}

interface ChatBoxProps {
  messages: Message[]
}

export default function ChatBox({ messages }: ChatBoxProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="chat-scroll overflow-y-auto flex-1 p-4" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {messages.map((msg, i) => {
        if (msg.from === 'system') {
          return (
            <div key={i} className="msg-in" style={{ textAlign: 'center', padding: '6px 0' }}>
              <span style={{
                fontSize: 12, color: '#71717a', fontStyle: 'italic',
                background: '#27272a', padding: '3px 10px', borderRadius: 999
              }}>
                {msg.text}
              </span>
            </div>
          )
        }

        const isMe = msg.from === 'me'
        return (
          <div key={i} className="msg-in" style={{
            display: 'flex',
            justifyContent: isMe ? 'flex-end' : 'flex-start',
          }}>
            {!isMe && (
              <span style={{
                fontSize: 11, color: '#71717a', fontWeight: 700,
                marginRight: 6, alignSelf: 'flex-end', marginBottom: 2,
                letterSpacing: '0.04em', flexShrink: 0
              }}>
                Stranger:
              </span>
            )}
            <span style={{
              maxWidth: '75%',
              padding: '8px 12px',
              borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: isMe ? '#2563eb' : '#27272a',
              color: isMe ? '#fff' : '#e4e4e7',
              fontSize: 14,
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}>
              {msg.text}
            </span>
            {isMe && (
              <span style={{
                fontSize: 11, color: '#71717a', fontWeight: 700,
                marginLeft: 6, alignSelf: 'flex-end', marginBottom: 2,
                flexShrink: 0
              }}>
                You:
              </span>
            )}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
