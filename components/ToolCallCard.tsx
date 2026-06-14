'use client'

import type { ToolCallState } from '@/types/protocol'
import { useState } from 'react'

interface ToolCallCardProps {
  toolCall: ToolCallState
  isSelected: boolean
  onSelect: () => void
}

export function ToolCallCard({ toolCall, isSelected, onSelect }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isPending  = toolCall.status === 'pending' || toolCall.status === 'acked'
  const isResolved = toolCall.status === 'resolved'

  const borderColor = isPending
    ? 'rgba(167,139,250,0.5)'
    : isResolved
    ? 'rgba(74,222,128,0.4)'
    : 'var(--color-border)'

  const bgColor = isPending
    ? 'rgba(167,139,250,0.08)'
    : isResolved
    ? 'rgba(74,222,128,0.05)'
    : 'transparent'

  return (
    <div
      onClick={onSelect}
      style={{
        border: `1px solid ${isSelected ? 'var(--color-primary)' : borderColor}`,
        background: isSelected ? 'rgba(79,156,249,0.08)' : bgColor,
        borderRadius: '8px',
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 180ms ease',
      }}
      data-call-id={toolCall.call_id}
      role="button"
      aria-expanded={expanded}
      aria-label={`Tool call: ${toolCall.tool_name}`}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Status icon */}
          {isPending ? (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-tool)',
                display: 'inline-block',
                animation: 'pulse 1s ease-in-out infinite',
                flexShrink: 0,
              }}
            />
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5.5" stroke="var(--color-success)" />
              <path d="M3.5 6l2 2 3-3" stroke="var(--color-success)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}

          {/* Tool name */}
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: 600,
              color: isPending ? 'var(--color-tool)' : 'var(--color-success)',
            }}
          >
            {toolCall.tool_name}
          </span>

          {/* Status badge */}
          <span
            style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '4px',
              background: isPending ? 'rgba(167,139,250,0.15)' : 'rgba(74,222,128,0.1)',
              color: isPending ? 'var(--color-tool)' : 'var(--color-success)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {toolCall.status === 'acked' ? 'waiting' : toolCall.status}
          </span>
        </div>

        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '2px',
            fontSize: '12px',
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded args + result */}
      {expanded && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Args */}
          <div>
            <div
              style={{
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted)',
                marginBottom: '4px',
              }}
            >
              Arguments
            </div>
            <pre
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: 'var(--color-text)',
                overflowX: 'auto',
                margin: 0,
                lineHeight: '1.5',
              }}
            >
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Result (if resolved) */}
          {isResolved && toolCall.result && (
            <div>
              <div
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-success)',
                  marginBottom: '4px',
                }}
              >
                Result
              </div>
              <pre
                style={{
                  background: 'rgba(74,222,128,0.04)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '11px',
                  color: 'var(--color-text)',
                  overflowX: 'auto',
                  margin: 0,
                  lineHeight: '1.5',
                }}
              >
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}