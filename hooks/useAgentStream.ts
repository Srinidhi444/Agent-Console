'use client'

import { useEffect, useRef, useCallback } from 'react'
import { WSManager } from '@/lib/ws-manager'
import { AgentStateMachine } from '@/lib/agent-state-machine'
import { useAgentStore } from '@/store/agent-store'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4747/ws'
const STREAM_INACTIVITY_MS = 6000

function makeEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAgentStream() {
  const wsManagerRef = useRef<WSManager | null>(null)
  const stateMachineRef = useRef<AgentStateMachine | null>(null)
  const initializedRef = useRef(false)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setConnectionStatus = useAgentStore((s) => s.setConnectionStatus)
  const addTraceEvent = useAgentStore((s) => s.addTraceEvent)
  const finalizeActiveStreamsOnDisconnect = useAgentStore(
    (s) => s.finalizeActiveStreamsOnDisconnect
  )
  const finalizeStaleActiveStream = useAgentStore(
    (s) => s.finalizeStaleActiveStream
  )

  // ✅ CHANGE 1: keep only activeStreamId as a ref — lastProcessedSeq ref removed
  const activeStreamId = useAgentStore((s) => s.activeStreamId)
  const activeStreamIdRef = useRef(activeStreamId)

  useEffect(() => {
    activeStreamIdRef.current = activeStreamId
  }, [activeStreamId])

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }, [])

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer()

    inactivityTimerRef.current = setTimeout(() => {
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
          id: makeEventId(`inactivity-${activeId}`),
          kind: 'connection',
          seq: null,
          timestamp: Date.now(),
          stream_id: activeId,
          summary: `Stream inactivity timeout: ${activeId}`,
          detail: {
            stream_id: activeId,
            previous_status: msg.status,
            timeout_ms: STREAM_INACTIVITY_MS,
          },
        })
      }
    }, STREAM_INACTIVITY_MS)
  }, [clearInactivityTimer])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const wsManager = new WSManager(
      WS_URL,
      (msg) => {
        const store = useAgentStore.getState()

        if (
          store.activeStreamId &&
          (msg.type === 'TOKEN' ||
            msg.type === 'TOOL_CALL' ||
            msg.type === 'TOOL_RESULT' ||
            msg.type === 'STREAM_END')
        ) {
          resetInactivityTimer()
        }

        if (msg.type === 'STREAM_END') {
          clearInactivityTimer()
        }

        stateMachineRef.current?.process(msg)
      },
      (status) => {
        setConnectionStatus(status)

        if (
          (status === 'reconnecting' || status === 'disconnected') &&
          activeStreamIdRef.current
        ) {
          clearInactivityTimer()
          finalizeActiveStreamsOnDisconnect()
        }

        if (status === 'resuming' && activeStreamIdRef.current) {
          resetInactivityTimer()
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
      // ✅ CHANGE 2: read directly from store — never stale
      () => useAgentStore.getState().lastProcessedSeq
    )

    const stateMachine = new AgentStateMachine(wsManager)

    wsManagerRef.current = wsManager
    stateMachineRef.current = stateMachine

    wsManager.connect()

    return () => {
      clearInactivityTimer()
      wsManager.disconnect()
      wsManagerRef.current = null
      stateMachineRef.current = null
      initializedRef.current = false
    }
  }, [
    setConnectionStatus,
    addTraceEvent,
    finalizeActiveStreamsOnDisconnect,
    finalizeStaleActiveStream,
    resetInactivityTimer,
    clearInactivityTimer,
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

  // ✅ CHANGE 3: also reset seq buffer on session clear so fresh connect starts from seq 1
  const resetSession = useCallback(() => {
    clearInactivityTimer()
    useAgentStore.getState().clearUiState()
    wsManagerRef.current?.resetBuffer()
  }, [clearInactivityTimer])

  return {
    sendMessage,
    resetSession,
  }
}