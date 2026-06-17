import type {
  ServerMessage,
  TokenMessage,
  ToolCallMessage,
  ToolResultMessage,
  ContextSnapshotMessage,
  StreamEndMessage,
  ErrorMessage,
  TraceEvent,
  ContextSnapshot,
  PingMessage,
} from '@/types/protocol'
import type { WSManager } from '@/lib/ws-manager'
import { useAgentStore } from '@/store/agent-store'

interface TokenBatch {
  stream_id: string
  texts: string[]
  started_at: number
  last_seq: number
}

export class AgentStateMachine {
  private wsManager: WSManager
  private tokenBatch: TokenBatch | null = null
  private tokenBatchTimer: ReturnType<typeof setTimeout> | null = null
  private readonly TOKEN_BATCH_FLUSH_MS = 500
  private ackedToolCalls = new Set<string>()

  constructor(wsManager: WSManager) {
    this.wsManager = wsManager
  }

  process(msg: ServerMessage): void {
    const store = useAgentStore.getState()

    switch (msg.type) {
      case 'TOKEN':
        this.handleToken(msg)
        break
      case 'TOOL_CALL':
        this.handleToolCall(msg)
        break
      case 'TOOL_RESULT':
        this.handleToolResult(msg)
        break
      case 'CONTEXT_SNAPSHOT':
        this.handleContextSnapshot(msg)
        break
      case 'STREAM_END':
        this.handleStreamEnd(msg)
        break
      case 'ERROR':
        this.handleError(msg)
        break
      case 'PING':
        this.handlePing(msg)
        break
      default: {
        const exhaustiveCheck: never = msg
        return exhaustiveCheck
      }
    }

    store.setLastProcessedSeq(msg.seq)
  }

  private handlePing(msg: PingMessage): void {
    this.addTraceEvent({
      kind: 'ping',
      seq: msg.seq,
      summary: `Ping: ${msg.challenge || '(empty)'}`,
      detail: { challenge: msg.challenge },
    })
  }

  private handleToken(msg: TokenMessage): void {
    const store = useAgentStore.getState()

    store.ensureChatMessage(msg.stream_id)
    store.appendToken(msg.stream_id, msg.seq, msg.text)
    store.setStreamStatus(msg.stream_id, 'streaming')

    this.accumulateTokenBatch(msg)
  }

  private handleToolCall(msg: ToolCallMessage): void {
    console.log('[AgentStateMachine] handleToolCall', {
  seq: msg.seq,
  stream_id: msg.stream_id,
  call_id: msg.call_id,
  tool_name: msg.tool_name,
})
    if (!this.ackedToolCalls.has(msg.call_id)) {
      this.wsManager.send({
        type: 'TOOL_ACK',
        call_id: msg.call_id,
      })
      this.ackedToolCalls.add(msg.call_id)
    }

    this.flushTokenBatch()

    const store = useAgentStore.getState()

    store.ensureChatMessage(msg.stream_id)

    const toolCall = {
      call_id: msg.call_id,
      tool_name: msg.tool_name,
      args: msg.args,
      result: null,
      status: 'acked' as const,
      seq: msg.seq,
      result_seq: null,
    }

    store.addToolCall(msg.stream_id, toolCall)
    store.setStreamStatus(msg.stream_id, 'tool_call_pending')

    this.addTraceEvent({
      kind: 'tool_call',
      seq: msg.seq,
      stream_id: msg.stream_id,
      call_id: msg.call_id,
      summary: `Tool call: ${msg.tool_name}`,
      detail: {
        tool_name: msg.tool_name,
        args: msg.args,
        call_id: msg.call_id,
      },
    })

    setTimeout(() => {
      const freshStore = useAgentStore.getState()
      const freshMsg = freshStore.getChatMessage(msg.stream_id)
      const tc = freshMsg?.tool_calls.find((t) => t.call_id === msg.call_id)

      if (tc && tc.status !== 'resolved') {
        freshStore.updateToolCallStatus(msg.call_id, 'timed_out')
        freshStore.setStreamStatus(msg.stream_id, 'interrupted')
      }
    }, 6000)
  }

  private handleToolResult(msg: ToolResultMessage): void {
    const store = useAgentStore.getState()

    store.ensureChatMessage(msg.stream_id)
    store.resolveToolCall(msg.call_id, msg.result, msg.seq)
    store.setStreamStatus(msg.stream_id, 'streaming')

    this.ackedToolCalls.delete(msg.call_id)

    this.addTraceEvent({
      kind: 'tool_result',
      seq: msg.seq,
      stream_id: msg.stream_id,
      call_id: msg.call_id,
      summary: `Tool result: ${msg.call_id}`,
      detail: {
        call_id: msg.call_id,
        result: msg.result,
      },
    })
  }

  private handleContextSnapshot(msg: ContextSnapshotMessage): void {
    const store = useAgentStore.getState()

    const snapshot: ContextSnapshot = {
      context_id: msg.context_id,
      seq: msg.seq,
      data: msg.data,
      timestamp: Date.now(),
    }

    store.addContextSnapshot(snapshot)

    this.addTraceEvent({
      kind: 'context_snapshot',
      seq: msg.seq,
      summary: `Context snapshot: ${msg.context_id}`,
      detail: {
        context_id: msg.context_id,
        keys: Object.keys(msg.data).length,
      },
    })
  }

  private handleStreamEnd(msg: StreamEndMessage): void {
    this.flushTokenBatch()

    const store = useAgentStore.getState()

    store.ensureChatMessage(msg.stream_id)
    store.setStreamStatus(msg.stream_id, 'completed')

    this.addTraceEvent({
      kind: 'stream_end',
      seq: msg.seq,
      stream_id: msg.stream_id,
      summary: `Stream ended: ${msg.stream_id}`,
      detail: {
        stream_id: msg.stream_id,
      },
    })
  }

  private handleError(msg: ErrorMessage): void {
    this.flushTokenBatch()

    const store = useAgentStore.getState()

    store.addError({
      code: msg.code,
      message: msg.message,
      seq: msg.seq,
    })

    this.addTraceEvent({
      kind: 'error',
      seq: msg.seq,
      summary: `Error: ${msg.code}`,
      detail: {
        code: msg.code,
        message: msg.message,
      },
    })
  }

  private accumulateTokenBatch(msg: TokenMessage): void {
    if (this.tokenBatch && this.tokenBatch.stream_id === msg.stream_id) {
      this.tokenBatch.texts.push(msg.text)
      this.tokenBatch.last_seq = msg.seq
    } else {
      this.flushTokenBatch()
      this.tokenBatch = {
        stream_id: msg.stream_id,
        texts: [msg.text],
        started_at: Date.now(),
        last_seq: msg.seq,
      }
    }

    if (this.tokenBatchTimer) {
      clearTimeout(this.tokenBatchTimer)
    }

    this.tokenBatchTimer = setTimeout(() => {
      this.flushTokenBatch()
    }, this.TOKEN_BATCH_FLUSH_MS)
  }

  flushTokenBatch(): void {
    if (!this.tokenBatch || this.tokenBatch.texts.length === 0) return

    if (this.tokenBatchTimer) {
      clearTimeout(this.tokenBatchTimer)
      this.tokenBatchTimer = null
    }

    const batch = this.tokenBatch
    const elapsed = ((Date.now() - batch.started_at) / 1000).toFixed(1)

    this.addTraceEvent({
      kind: 'token_batch',
      seq: batch.last_seq,
      stream_id: batch.stream_id,
      summary: `Streamed ${batch.texts.length} tokens (${elapsed}s)`,
      detail: {
        text: batch.texts.join(''),
        count: batch.texts.length,
      },
    })

    this.tokenBatch = null
  }

  private addTraceEvent(
    event: Omit<TraceEvent, 'id' | 'timestamp'>
  ): void {
    const store = useAgentStore.getState()

    const traceEvent: TraceEvent = {
      ...event,
      id: `${event.kind}-${event.seq ?? Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      timestamp: Date.now(),
    }

    store.addTraceEvent(traceEvent)
  }
}