'use client'

import { useEffect, useRef, useCallback } from 'react'
import { WSManager } from '@/lib/ws-manager'
import { AgentStateMachine } from '@/lib/agent-state-machine'
import { useAgentStore } from '@/store/agent-store'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4747/ws'

function makeEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAgentStream() {
  const wsManagerRef = useRef<WSManager | null>(null)
  const stateMachineRef = useRef<AgentStateMachine | null>(null)
  const initializedRef = useRef(false)

  const setConnectionStatus = useAgentStore((s) => s.setConnectionStatus)
  const addTraceEvent = useAgentStore((s) => s.addTraceEvent)
  const lastProcessedSeq = useAgentStore((s) => s.lastProcessedSeq)

  const lastProcessedSeqRef = useRef(lastProcessedSeq)

  useEffect(() => {
    lastProcessedSeqRef.current = lastProcessedSeq
  }, [lastProcessedSeq])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const wsManager = new WSManager(
      WS_URL,
      (msg) => {
        stateMachineRef.current?.process(msg)
      },
      (status) => {
        setConnectionStatus(status)
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
      wsManager.disconnect()
      wsManagerRef.current = null
      stateMachineRef.current = null
      initializedRef.current = false
    }
  }, [setConnectionStatus, addTraceEvent])

  const sendMessage = useCallback((content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const chatMessages = useAgentStore.getState().chatMessages
    const latest = chatMessages.at(-1)
    const isBusy =
      latest?.status === 'streaming' ||
      latest?.status === 'tool_call_pending'

    if (isBusy) return

    wsManagerRef.current?.send({
      type: 'USER_MESSAGE',
      content: trimmed,
    })
  }, [])

  const resetSession = useCallback(() => {
    useAgentStore.getState().clearUiState()
  }, [])

  return {
    sendMessage,
    resetSession,
  }
}