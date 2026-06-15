'use client'

import { useEffect, useRef, useCallback } from 'react'
import { WSManager } from '@/lib/ws-manager'
import { AgentStateMachine } from '@/lib/agent-state-machine'
import { useAgentStore } from '@/store/agent-store'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4747/ws'
const RESUME_SETTLE_MS = 4000

function makeEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAgentStream() {
  const wsManagerRef = useRef<WSManager | null>(null)
  const stateMachineRef = useRef<AgentStateMachine | null>(null)
  const initializedRef = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setConnectionStatus = useAgentStore((s) => s.setConnectionStatus)
  const addTraceEvent = useAgentStore((s) => s.addTraceEvent)
  const finalizeActiveStreamsOnDisconnect = useAgentStore(
    (s) => s.finalizeActiveStreamsOnDisconnect
  )
  const finalizeStaleActiveStream = useAgentStore((s) => s.finalizeStaleActiveStream)
  const lastProcessedSeq = useAgentStore((s) => s.lastProcessedSeq)
  const activeStreamId = useAgentStore((s) => s.activeStreamId)

  const lastProcessedSeqRef = useRef(lastProcessedSeq)
  const activeStreamIdRef = useRef(activeStreamId)

  useEffect(() => {
    lastProcessedSeqRef.current = lastProcessedSeq
  }, [lastProcessedSeq])

  useEffect(() => {
    activeStreamIdRef.current = activeStreamId
  }, [activeStreamId])

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
  }, [])

  const armResumeWatchdog = useCallback(() => {
    clearResumeTimer()

    resumeTimerRef.current = setTimeout(() => {
      const store = useAgentStore.getState()
      const activeId = store.activeStreamId
      if (!activeId) return

      const msg = store.getChatMessage(activeId)
      if (!msg) return

      if (
        msg.status === 'streaming' ||
        msg.status === 'tool_call_pending' ||
        msg.status === 'awaiting_result'
      ) {
        store.finalizeStaleActiveStream()
        store.addTraceEvent({
          id: makeEventId(`resume-timeout-${activeId}`),
          kind: 'connection',
          seq: null,
          timestamp: Date.now(),
          stream_id: activeId,
          summary: `Resume watchdog interrupted stale stream: ${activeId}`,
          detail: {
            stream_id: activeId,
            previous_status: msg.status,
            timeout_ms: RESUME_SETTLE_MS,
          },
        })
      }
    }, RESUME_SETTLE_MS)
  }, [clearResumeTimer])

  useEffect(() => {
    if (activeStreamId) {
      clearResumeTimer()
    }
  }, [activeStreamId, clearResumeTimer])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const wsManager = new WSManager(
      WS_URL,
      (msg) => {
        clearResumeTimer()
        stateMachineRef.current?.process(msg)
      },
      (status) => {
        setConnectionStatus(status)

        if (
          (status === 'reconnecting' || status === 'disconnected') &&
          activeStreamIdRef.current
        ) {
          finalizeActiveStreamsOnDisconnect()
        }

        if (status === 'resuming') {
          armResumeWatchdog()
        }

        if (status === 'connected' && !activeStreamIdRef.current) {
          clearResumeTimer()
        }

        addTraceEvent({
          id: makeEventId(`conn-${status}`),
          kind: 'connection',
          seq: null,
          timestamp: Date.now(),
          summary: `Connection: ${status}`,
          detail: { status },
        })
      },
      () => lastProcessedSeqRef.current
    )

    const stateMachine = new AgentStateMachine(wsManager)

    wsManagerRef.current = wsManager
    stateMachineRef.current = stateMachine

    wsManager.connect()

    return () => {
      clearResumeTimer()
      wsManager.disconnect()
      wsManagerRef.current = null
      stateMachineRef.current = null
      initializedRef.current = false
    }
  }, [
    setConnectionStatus,
    addTraceEvent,
    finalizeActiveStreamsOnDisconnect,
    armResumeWatchdog,
    clearResumeTimer,
  ])

  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    if (useAgentStore.getState().activeStreamId) return

    wsManagerRef.current?.send({
      type: 'USER_MESSAGE',
      content: trimmed,
    })
  }, [])

  const resetSession = useCallback(() => {
    clearResumeTimer()
    useAgentStore.getState().clearUiState()
  }, [clearResumeTimer])

  return {
    sendMessage,
    resetSession,
  }
}