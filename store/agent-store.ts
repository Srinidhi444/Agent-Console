import { create } from 'zustand'
import type {
  ChatMessage,
  ToolCallState,
  TraceEvent,
  ContextSnapshot,
  ConnectionStatus,
  StreamStatus,
} from '@/types/protocol'

interface ErrorEntry {
  code: string
  message: string
  seq: number
}

interface AgentStore {
  connectionStatus: ConnectionStatus
  lastProcessedSeq: number
  setConnectionStatus: (status: ConnectionStatus) => void
  setLastProcessedSeq: (seq: number) => void

  chatMessages: ChatMessage[]
  getChatMessage: (stream_id: string) => ChatMessage | undefined
  addChatMessage: (msg: ChatMessage) => void
  appendToken: (stream_id: string, text: string) => void
  addToolCall: (stream_id: string, toolCall: ToolCallState) => void
  updateToolCallStatus: (call_id: string, status: ToolCallState['status']) => void
  resolveToolCall: (
    call_id: string,
    result: Record<string, unknown>,
    result_seq: number
  ) => void
  setStreamStatus: (stream_id: string, status: StreamStatus) => void

  traceEvents: TraceEvent[]
  addTraceEvent: (event: TraceEvent) => void
  clearTrace: () => void

  contextSnapshots: Record<string, ContextSnapshot[]>
  addContextSnapshot: (snapshot: ContextSnapshot) => void

  errors: ErrorEntry[]
  addError: (error: ErrorEntry) => void

  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void

  clearUiState: () => void
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  connectionStatus: 'disconnected',
  lastProcessedSeq: 0,

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLastProcessedSeq: (seq) =>
    set((state) => ({
      lastProcessedSeq: Math.max(state.lastProcessedSeq, seq),
    })),

  chatMessages: [],

  getChatMessage: (stream_id) =>
    get().chatMessages.find((m) => m.stream_id === stream_id),

  addChatMessage: (msg) =>
    set((state) => {
      const exists = state.chatMessages.some((m) => m.stream_id === msg.stream_id)
      if (exists) return state
      return {
        chatMessages: [...state.chatMessages, msg],
      }
    }),

  appendToken: (stream_id, text) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) =>
        m.stream_id === stream_id
          ? { ...m, tokens: [...m.tokens, text] }
          : m
      ),
    })),

  addToolCall: (stream_id, toolCall) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) => {
        if (m.stream_id !== stream_id) return m
        const exists = m.tool_calls.some((tc) => tc.call_id === toolCall.call_id)
        if (exists) return m
        return {
          ...m,
          tool_calls: [...m.tool_calls, toolCall],
        }
      }),
    })),

  updateToolCallStatus: (call_id, status) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) => ({
        ...m,
        tool_calls: m.tool_calls.map((tc) =>
          tc.call_id === call_id ? { ...tc, status } : tc
        ),
      })),
    })),

  resolveToolCall: (call_id, result, result_seq) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) => ({
        ...m,
        tool_calls: m.tool_calls.map((tc) =>
          tc.call_id === call_id
            ? { ...tc, result, result_seq, status: 'resolved' as const }
            : tc
        ),
      })),
    })),

  setStreamStatus: (stream_id, status) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) => {
        if (m.stream_id !== stream_id) return m

        const nextStatus =
          m.status === 'completed' && status === 'streaming'
            ? m.status
            : status

        return {
          ...m,
          status: nextStatus,
          ended_at: nextStatus === 'completed' ? Date.now() : m.ended_at,
        }
      }),
    })),

  traceEvents: [],

  addTraceEvent: (event) =>
    set((state) => ({
      traceEvents: [...state.traceEvents, event],
    })),

  clearTrace: () =>
    set({
      traceEvents: [],
    }),

  contextSnapshots: {},

  addContextSnapshot: (snapshot) =>
    set((state) => {
      const existing = state.contextSnapshots[snapshot.context_id] ?? []
      const exists = existing.some((s) => s.seq === snapshot.seq)

      return {
        contextSnapshots: {
          ...state.contextSnapshots,
          [snapshot.context_id]: exists ? existing : [...existing, snapshot],
        },
      }
    }),

  errors: [],

  addError: (error) =>
    set((state) => ({
      errors: [...state.errors, error],
    })),

  selectedEventId: null,

  setSelectedEventId: (id) =>
    set({
      selectedEventId: id,
    }),

  clearUiState: () =>
    set((state) => ({
      chatMessages: [],
      traceEvents: [],
      contextSnapshots: {},
      errors: [],
      selectedEventId: null,
      connectionStatus: state.connectionStatus,
      lastProcessedSeq: state.lastProcessedSeq,
    })),
}))