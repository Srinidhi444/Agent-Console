'use client'

import { useAgentStream } from '@/hooks/useAgentStream'
import { ChatPanel } from '@/components/ChatPanel'
import { TraceTimeline } from '@/components/TraceTimeline'
import { ContextInspector } from '@/components/ContextInspector'
import { ReconnectIndicator } from '@/components/ReconnectIndicator'
import { useState } from 'react'

export default function Page() {
  const { sendMessage, resetSession } = useAgentStream()
  const [showTimeline, setShowTimeline] = useState(true)
  const [showContext, setShowContext] = useState(true)

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)]">

      {/* Top bar */}
      <header
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 16px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* SVG logo */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Agent Console">
            <rect x="3" y="3" width="8" height="8" rx="1.5" fill="var(--color-primary)" opacity="0.9"/>
            <rect x="13" y="3" width="8" height="8" rx="1.5" fill="var(--color-tool)" opacity="0.7"/>
            <rect x="3" y="13" width="8" height="8" rx="1.5" fill="var(--color-tool)" opacity="0.7"/>
            <rect x="13" y="13" width="8" height="8" rx="1.5" fill="var(--color-primary)" opacity="0.5"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--color-text)' }}>
            Agent Console
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ReconnectIndicator />
          <button
            onClick={() => setShowTimeline(v => !v)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: showTimeline ? 'var(--color-primary-dim)' : 'transparent',
              border: '1px solid var(--color-border)',
              color: showTimeline ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Timeline
          </button>
          <button
            onClick={() => setShowContext(v => !v)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: showContext ? 'var(--color-tool-dim)' : 'transparent',
              border: '1px solid var(--color-border)',
              color: showContext ? 'var(--color-tool)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Context
          </button>
          <button
            onClick={resetSession}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Reset
          </button>
        </div>
      </header>

      {/* Main 3-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Chat panel — always visible */}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <ChatPanel sendMessage={sendMessage} />
        </div>

        {/* Trace timeline — toggleable */}
        {showTimeline && (
          <div
            style={{
              width: '320px',
              flexShrink: 0,
              borderLeft: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <TraceTimeline />
          </div>
        )}

        {/* Context inspector — toggleable */}
        {showContext && (
          <div
            style={{
              width: '300px',
              flexShrink: 0,
              borderLeft: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <ContextInspector />
          </div>
        )}
      </div>
    </div>
  )
}