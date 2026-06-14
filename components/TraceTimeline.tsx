'use client'

import { useAgentStore } from '@/store/agent-store'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { TraceEvent, TraceEventKind } from '@/types/protocol'

const KIND_COLOR: Record<TraceEventKind, string> = {
  token_batch:      'var(--color-primary)',
  tool_call:        'var(--color-tool)',
  tool_result:      'var(--color-success)',
  context_snapshot: 'var(--color-warning)',
  ping:             'var(--color-text-muted)',
  pong:             'var(--color-text-muted)',
  stream_end:       'var(--color-text-muted)',
  error:            'var(--color-error)',
  connection:       'var(--color-primary)',
}

const KIND_LABEL: Record<TraceEventKind, string> = {
  token_batch:      'TOKENS',
  tool_call:        'TOOL CALL',
  tool_result:      'TOOL RESULT',
  context_snapshot: 'CONTEXT',
  ping:             'PING',
  pong:             'PONG',
  stream_end:       'STREAM END',
  error:            'ERROR',
  connection:       'CONNECTION',
}

const ALL_KINDS = Object.keys(KIND_LABEL) as TraceEventKind[]

interface TraceRowProps {
  event: TraceEvent
  isSelected: boolean
  onSelect: () => void
}

function TraceRow({ event, isSelected, onSelect }: TraceRowProps) {
  const [expanded, setExpanded] = useState(false)
  const color = KIND_COLOR[event.kind]

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '7px 12px',
        borderBottom: '1px solid var(--color-border)',
        background: isSelected ? 'rgba(79,156,249,0.08)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 120ms ease',
        borderLeft: `2px solid ${isSelected ? color : 'transparent'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Kind badge */}
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: '3px',
            background: `${color}20`,
            color,
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          {KIND_LABEL[event.kind]}
        </span>

        {/* Summary */}
        <span
          style={{
            fontSize: '12px',
            color: 'var(--color-text)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.summary}
        </span>

        {/* Seq */}
        {event.seq !== null && (
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
            #{event.seq}
          </span>
        )}

        {/* Expand */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '0 2px',
            flexShrink: 0,
          }}
          aria-label={expanded ? 'Collapse detail' : 'Expand detail'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Timestamp */}
      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px', paddingLeft: '0' }}>
        {new Date(event.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        })}
        {event.call_id && (
          <span style={{ marginLeft: '6px', opacity: 0.6 }}>
            call: {event.call_id.slice(0, 12)}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <pre
          style={{
            marginTop: '6px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
            padding: '6px 8px',
            fontSize: '10px',
            color: 'var(--color-text)',
            overflowX: 'auto',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        >
          {JSON.stringify(event.detail, null, 2)}
        </pre>
      )}
    </div>
  )
}

export function TraceTimeline() {
  const traceEvents = useAgentStore((s) => s.traceEvents)
  const selectedEventId = useAgentStore((s) => s.selectedEventId)
  const setSelectedEventId = useAgentStore((s) => s.setSelectedEventId)
  const clearTrace = useAgentStore((s) => s.clearTrace)

  const [filter, setFilter] = useState<TraceEventKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = traceEvents.filter((e) => {
    if (filter !== 'all' && e.kind !== filter) return false
    if (search && !e.summary.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filtered.length, autoScroll])

  // Detect manual scroll up to pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
    setAutoScroll(atBottom)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>
            Trace Timeline
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
              {filtered.length} events
            </span>
            <button
              onClick={clearTrace}
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                color: 'var(--color-text-muted)',
                fontSize: '10px',
                padding: '1px 6px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '5px',
            padding: '5px 8px',
            color: 'var(--color-text)',
            fontSize: '11px',
            outline: 'none',
            marginBottom: '6px',
          }}
        />

        {/* Filter chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              border: 'none',
              background: filter === 'all' ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
              color: filter === 'all' ? '#fff' : 'var(--color-text-muted)',
              fontSize: '10px',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {ALL_KINDS.map((kind) => (
            <button
              key={kind}
              onClick={() => setFilter(kind)}
              style={{
                padding: '2px 7px',
                borderRadius: '4px',
                border: 'none',
                background: filter === kind ? `${KIND_COLOR[kind]}30` : 'rgba(255,255,255,0.06)',
                color: filter === kind ? KIND_COLOR[kind] : 'var(--color-text-muted)',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      </div>

      {/* Event list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto' }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
            }}
          >
            No events yet
          </div>
        ) : (
          filtered.map((event) => (
            <TraceRow
              key={event.id}
              event={event}
              isSelected={selectedEventId === event.id}
              onSelect={() =>
                setSelectedEventId(selectedEventId === event.id ? null : event.id)
              }
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }}
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            background: 'var(--color-primary)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '11px',
            padding: '5px 10px',
            cursor: 'pointer',
          }}
        >
          ↓ Latest
        </button>
      )}
    </div>
  )
}