'use client'

import { useAgentStore } from '@/store/agent-store'
import { StreamingMessage } from './StreamingMessage'
import { useEffect, useRef, useState } from 'react'

interface ChatPanelProps {
  sendMessage: (content: string) => void
}

export function ChatPanel({ sendMessage }: ChatPanelProps) {
  const chatMessages = useAgentStore((s) => s.chatMessages)

  const latestMessage = chatMessages.at(-1)
  const isStreaming =
    latestMessage?.status === 'streaming' ||
    latestMessage?.status === 'tool_call_pending'

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    sendMessage(trimmed)
    setInput('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {chatMessages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              gap: '8px',
              marginTop: '80px',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ fontSize: '14px' }}>Send a message to start</p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <StreamingMessage key={msg.stream_id} message={msg} />
        ))}

        <div ref={bottomRef} />
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={isStreaming}
          style={{
            flex: 1,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '10px 12px',
            color: 'var(--color-text)',
            fontSize: '14px',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.5',
            minHeight: '42px',
            maxHeight: '120px',
            opacity: isStreaming ? 0.8 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            background:
              !input.trim() || isStreaming
                ? 'var(--color-surface-2)'
                : 'var(--color-primary)',
            border: 'none',
            color:
              !input.trim() || isStreaming
                ? 'var(--color-text-muted)'
                : '#fff',
            fontWeight: 600,
            fontSize: '14px',
            cursor:
              !input.trim() || isStreaming ? 'not-allowed' : 'pointer',
            transition: 'all 180ms ease',
            height: '42px',
            whiteSpace: 'nowrap',
          }}
        >
          {isStreaming ? 'Waiting…' : 'Send'}
        </button>
      </div>
    </div>
  )
}