'use client'

import { useAgentStore } from '@/store/agent-store'

const STATUS_CONFIG = {
  connected:     { color: 'var(--color-success)', label: 'Connected',     dot: true  },
  connecting:    { color: 'var(--color-warning)',  label: 'Connecting…',   dot: true  },
  reconnecting:  { color: 'var(--color-error)',    label: 'Reconnecting…', dot: true  },
  resuming:      { color: 'var(--color-primary)',  label: 'Resuming…',     dot: true  },
  disconnected:  { color: 'var(--color-text-muted)', label: 'Disconnected', dot: false },
}

export function ReconnectIndicator() {
  const status = useAgentStore((s) => s.connectionStatus)
  const config = STATUS_CONFIG[status]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--color-border)',
      }}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${config.label}`}
    >
      {/* Animated dot */}
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: config.color,
          display: 'inline-block',
          animation:
            status === 'reconnecting' || status === 'connecting' || status === 'resuming'
              ? 'pulse 1s ease-in-out infinite'
              : 'none',
        }}
      />
      <span style={{ fontSize: '12px', color: config.color }}>
        {config.label}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}