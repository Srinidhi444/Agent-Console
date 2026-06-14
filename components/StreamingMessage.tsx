'use client'

import { useAgentStore } from '@/store/agent-store'
import { ToolCallCard } from './ToolCallCard'
import type { ChatMessage } from '@/types/protocol'
import { useRef, useEffect } from 'react'

interface StreamingMessageProps {
  message: ChatMessage
}

export function StreamingMessage({ message }: StreamingMessageProps) {
  const selectedEventId = useAgentStore((s) => s.selectedEventId)
  const setSelectedEventId = useAgentStore((s) => s.setSelectedEventId)

  const containerRef = useRef<HTMLDivElement>(null)
  const frozenHeightRef = useRef<number | null>(null)

  const fullText = message.tokens.join('')
  const isStreaming = message.status === 'streaming'
  const isToolPending =
    message.status === 'tool_call_pending' ||
    message.status === 'awaiting_result'
  const isCompleted = message.status === 'completed'

  // When a tool call interrupts, lock the height of the text
  // container to prevent layout shift
  useEffect(() => {
    if (isToolPending && containerRef.current && frozenHeightRef.current === null) {
      frozenHeightRef.current = containerRef.current.getBoundingClientRect().height
    }
    if (!isToolPending) {
      frozenHeightRef.current = null
    }
  }, [isToolPending])

  const isHighlighted = message.tool_calls.some(
    (tc) =>
      selectedEventId === `tool_call-${tc.seq}-${tc.call_id}` ||
      selectedEventId === tc.call_id
  )

  return (
    <div
      style={{
        background: isHighlighted ? 'rgba(79,156,249,0.05)' : 'var(--color-surface)',
        border: `1px solid ${isHighlighted ? 'rgba(79,156,249,0.3)' : 'var(--color-border)'}`,
        borderRadius: '10px',
        padding: '14px 16px',
        transition: 'border-color 200ms ease, background 200ms ease',
      }}
      data-stream-id={message.stream_id}
    >
      {/* Agent label */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--color-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>Agent</span>
        {(isStreaming || isToolPending) && (
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-primary)',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          />
        )}
        {isCompleted && (
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, textTransform: 'none' }}>
            · {message.stream_id}
          </span>
        )}
      </div>

      {/* Token text — frozen height when tool call interrupts */}
      <div
        ref={containerRef}
        style={{
          color: 'var(--color-text)',
          lineHeight: '1.7',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          minHeight: frozenHeightRef.current
            ? `${frozenHeightRef.current}px`
            : undefined,
          transition: 'min-height 150ms ease',
        }}
      >
        {fullText}
        {/* Blinking cursor while streaming */}
        {isStreaming && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '1em',
              background: 'var(--color-primary)',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'blink 1s step-end infinite',
            }}
          />
        )}
      </div>

      {/* Tool call cards — stacked sequence */}
      {message.tool_calls.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {message.tool_calls.map((tc) => (
            <ToolCallCard
              key={tc.call_id}
              toolCall={tc}
              isSelected={selectedEventId === tc.call_id}
              onSelect={() =>
                setSelectedEventId(
                  selectedEventId === tc.call_id ? null : tc.call_id
                )
              }
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}