'use client'

import { useAgentStore } from '@/store/agent-store'
import { useState } from 'react'
import { diffObjects } from '../lib/context-differ'
import type { ContextSnapshot } from '@/types/protocol'

function JsonTree({
  data,
  depth = 0,
}: {
  data: unknown
  depth?: number
}) {
  const [collapsed, setCollapsed] = useState(depth > 1)

  if (data === null) return <span style={{ color: '#6b7280' }}>null</span>
  if (typeof data === 'boolean') return <span style={{ color: '#f59e0b' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: '#34d399' }}>{data}</span>
  if (typeof data === 'string') return <span style={{ color: '#93c5fd' }}>"{data}"</span>

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>[]</span>
    return (
      <span>
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}
        >
          {collapsed ? `▶ [${data.length}]` : '▼ ['}
        </button>
        {!collapsed && (
          <div style={{ paddingLeft: '16px' }}>
            {data.map((item, i) => (
              <div key={i}>
                <JsonTree data={item} depth={depth + 1} />
                {i < data.length - 1 && <span style={{ color: 'var(--color-text-muted)' }}>,</span>}
              </div>
            ))}
            <span style={{ color: 'var(--color-text-muted)' }}>]</span>
          </div>
        )}
      </span>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data as object)
    if (keys.length === 0) return <span style={{ color: 'var(--color-text-muted)' }}>{'{}'}</span>
    return (
      <span>
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}
        >
          {collapsed ? `▶ {${keys.length}}` : '▼ {'}
        </button>
        {!collapsed && (
          <div style={{ paddingLeft: '16px' }}>
            {keys.map((key, i) => (
              <div key={key}>
                <span style={{ color: '#f9a8d4' }}>"{key}"</span>
                <span style={{ color: 'var(--color-text-muted)' }}>: </span>
                <JsonTree data={(data as Record<string, unknown>)[key]} depth={depth + 1} />
                {i < keys.length - 1 && <span style={{ color: 'var(--color-text-muted)' }}>,</span>}
              </div>
            ))}
            <span style={{ color: 'var(--color-text-muted)' }}>{'}'}</span>
          </div>
        )}
      </span>
    )
  }

  return <span>{String(data)}</span>
}

function SnapshotDiff({ prev, curr }: { prev: ContextSnapshot; curr: ContextSnapshot }) {
  const changes = diffObjects(prev.data, curr.data)

  if (changes.length === 0) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', padding: '8px 0' }}>
        No changes from previous snapshot
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {changes.map((change) => (
        <div
          key={change.path}
          style={{
            padding: '4px 8px',
            borderRadius: '4px',
            background:
              change.kind === 'added'
                ? 'rgba(74,222,128,0.08)'
                : change.kind === 'removed'
                ? 'rgba(248,113,113,0.08)'
                : 'rgba(251,191,36,0.08)',
            border: `1px solid ${
              change.kind === 'added'
                ? 'rgba(74,222,128,0.2)'
                : change.kind === 'removed'
                ? 'rgba(248,113,113,0.2)'
                : 'rgba(251,191,36,0.2)'
            }`,
            fontSize: '11px',
          }}
        >
          <span
            style={{
              color:
                change.kind === 'added'
                  ? 'var(--color-success)'
                  : change.kind === 'removed'
                  ? 'var(--color-error)'
                  : 'var(--color-warning)',
              fontWeight: 600,
              marginRight: '6px',
            }}
          >
            {change.kind === 'added' ? '+' : change.kind === 'removed' ? '-' : '~'}
          </span>
          <code style={{ color: 'var(--color-text)' }}>{change.path}</code>
          {change.kind === 'changed' && (
            <span style={{ color: 'var(--color-text-muted)', marginLeft: '6px' }}>
              {JSON.stringify(change.oldValue)} → {JSON.stringify(change.newValue)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export function ContextInspector() {
  const contextSnapshots = useAgentStore((s) => s.contextSnapshots)
  const [activeContextId, setActiveContextId] = useState<string | null>(null)
  const [snapshotIndex, setSnapshotIndex] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<'data' | 'diff'>('data')

  const contextIds = Object.keys(contextSnapshots)

  const currentId = activeContextId ?? contextIds[0] ?? null
  const snapshots = currentId ? (contextSnapshots[currentId] ?? []) : []
  const currentSnapshot = snapshots[snapshotIndex] ?? null
  const prevSnapshot = snapshotIndex > 0 ? snapshots[snapshotIndex - 1] ?? null : null

  // When new context arrives, update index to latest
  const latestLen = snapshots.length
  const prevLatestLen = useAgentStore.getState().contextSnapshots[currentId ?? '']?.length ?? 0

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
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text)' }}>
          Context Inspector
        </div>

        {/* Context ID selector */}
        {contextIds.length > 0 && (
          <select
            value={currentId ?? ''}
            onChange={(e) => {
              setActiveContextId(e.target.value)
              setSnapshotIndex(0)
            }}
            style={{
              width: '100%',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: '5px',
              padding: '4px 8px',
              color: 'var(--color-text)',
              fontSize: '11px',
              marginBottom: '6px',
              outline: 'none',
            }}
          >
            {contextIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        )}

        {/* History scrubber */}
        {snapshots.length > 1 && (
          <div style={{ marginBottom: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                Snapshot {snapshotIndex + 1} / {snapshots.length}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setSnapshotIndex(Math.max(0, snapshotIndex - 1))}
                  disabled={snapshotIndex === 0}
                  style={{
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: '3px',
                    color: snapshotIndex === 0 ? 'var(--color-text-muted)' : 'var(--color-text)',
                    cursor: snapshotIndex === 0 ? 'not-allowed' : 'pointer',
                    padding: '1px 6px',
                    fontSize: '10px',
                  }}
                >
                  ←
                </button>
                <button
                  onClick={() => setSnapshotIndex(Math.min(snapshots.length - 1, snapshotIndex + 1))}
                  disabled={snapshotIndex === snapshots.length - 1}
                  style={{
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: '3px',
                    color: snapshotIndex === snapshots.length - 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
                    cursor: snapshotIndex === snapshots.length - 1 ? 'not-allowed' : 'pointer',
                    padding: '1px 6px',
                    fontSize: '10px',
                  }}
                >
                  →
                </button>
                <button
                  onClick={() => setSnapshotIndex(snapshots.length - 1)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: '3px',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '1px 6px',
                    fontSize: '10px',
                  }}
                >
                  Latest
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={snapshots.length - 1}
              value={snapshotIndex}
              onChange={(e) => setSnapshotIndex(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--color-warning)' }}
            />
          </div>
        )}

        {/* Data / Diff tabs */}
        {currentSnapshot && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['data', 'diff'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  background:
                    activeTab === tab
                      ? 'var(--color-warning)'
                      : 'rgba(255,255,255,0.06)',
                  color: activeTab === tab ? '#000' : 'var(--color-text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab ? 600 : 400,
                }}
              >
                {tab === 'data' ? 'Data' : 'Diff'}
                {tab === 'diff' && prevSnapshot && (
                  <span
                    style={{
                      marginLeft: '4px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '3px',
                      padding: '0 3px',
                      fontSize: '9px',
                    }}
                  >
                    {diffObjects(prevSnapshot.data, currentSnapshot.data).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {!currentSnapshot ? (
          <div
            style={{
              padding: '32px 0',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
            }}
          >
            No context snapshots yet
          </div>
        ) : activeTab === 'data' ? (
          <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.6' }}>
            <JsonTree data={currentSnapshot.data} depth={0} />
          </div>
        ) : (
          <div>
            {prevSnapshot ? (
              <SnapshotDiff prev={prevSnapshot} curr={currentSnapshot} />
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                No previous snapshot to diff against
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}