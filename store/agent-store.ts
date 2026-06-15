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
  activeStreamId: string | null

  setConnectionStatus: (status: ConnectionStatus) => void
  setLastProcessedSeq: (seq: number) => void
  setActiveStreamId: (streamId: string | null) => void

  chatMessages: ChatMessage[]
  getChatMessage: (stream_id: string) => ChatMessage | undefined
  addChatMessage: (msg: ChatMessage) => void
  ensureChatMessage: (stream_id: string) => void
  appendToken: (stream_id: string, seq: number, text: string) => void
  addToolCall: (stream_id: string, toolCall: ToolCallState) => void
  updateToolCallStatus: (
    call_id: string,
    status: ToolCallState['status']
  ) => void
  resolveToolCall: (
    call_id: string,
    result: Record<string, unknown>,
    result_seq: number
  ) => void
  setStreamStatus: (stream_id: string, status: StreamStatus) => void
  finalizeActiveStreamsOnDisconnect: () => void
  finalizeStaleActiveStream: () => void

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

function makeChatMessage(stream_id: string): ChatMessage {
  return {
    id: stream_id,
    stream_id,
    tokens: [],
    token_seqs: [],
    tool_calls: [],
    status: 'idle',
    started_at: Date.now(),
    ended_at: null,
  }
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  connectionStatus: 'disconnected',
  lastProcessedSeq: 0,
  activeStreamId: null,

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLastProcessedSeq: (seq) =>
    set((state) => ({
      lastProcessedSeq: Math.max(state.lastProcessedSeq, seq),
    })),

  setActiveStreamId: (streamId) => set({ activeStreamId: streamId }),

  chatMessages: [],

  getChatMessage: (stream_id) =>
    get().chatMessages.find((m) => m.stream_id === stream_id),

  addChatMessage: (msg) =>
    set((state) => {
      const exists = state.chatMessages.some((m) => m.stream_id === msg.stream_id)
      if (exists) return state
      return { chatMessages: [...state.chatMessages, msg] }
    }),

  ensureChatMessage: (stream_id) =>
    set((state) => {
      const exists = state.chatMessages.some((m) => m.stream_id === stream_id)
      if (exists) return state
      return { chatMessages: [...state.chatMessages, makeChatMessage(stream_id)] }
    }),

  appendToken: (stream_id, seq, text) =>
    set((state) => {
      let didAppend = false

      const chatMessages = state.chatMessages.map((m) => {
        if (m.stream_id !== stream_id) return m
        if (m.token_seqs.includes(seq)) return m

        didAppend = true

        return {
          ...m,
          tokens: [...m.tokens, text],
          token_seqs: [...m.token_seqs, seq],
          status:
            m.status === 'completed' || m.status === 'interrupted'
              ? m.status
              : 'streaming',
        }
      })

      return {
        chatMessages,
        activeStreamId: didAppend ? stream_id : state.activeStreamId,
      }
    }),

  addToolCall: (stream_id, toolCall) =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) => {
        if (m.stream_id !== stream_id) return m

        const exists = m.tool_calls.some((tc) => tc.call_id === toolCall.call_id)
        if (exists) return m

        return {
          ...m,
          tool_calls: [...m.tool_calls, toolCall],
          status:
            m.status === 'completed' || m.status === 'interrupted'
              ? m.status
              : 'tool_call_pending',
        }
      }),
      activeStreamId: stream_id,
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
    set((state) => {
      const chatMessages = state.chatMessages.map((m) => {
        if (m.stream_id !== stream_id) return m

        const terminal = m.status === 'completed' || m.status === 'interrupted'
        const nextStatus =
          terminal && status === 'streaming'
            ? m.status
            : terminal && status === 'tool_call_pending'
              ? m.status
              : status

        return {
          ...m,
          status: nextStatus,
          ended_at:
            nextStatus === 'completed' || nextStatus === 'interrupted'
              ? m.ended_at ?? Date.now()
              : null,
        }
      })

      return {
        chatMessages,
        activeStreamId:
          status === 'completed' || status === 'interrupted'
            ? state.activeStreamId === stream_id
              ? null
              : state.activeStreamId
            : stream_id,
      }
    }),

  finalizeActiveStreamsOnDisconnect: () =>
    set((state) => ({
      chatMessages: state.chatMessages.map((m) =>
        m.status === 'streaming' ||
        m.status === 'tool_call_pending' ||
        m.status === 'awaiting_result'
          ? {
              ...m,
              status: 'interrupted',
              ended_at: m.ended_at ?? Date.now(),
            }
          : m
      ),
      activeStreamId: null,
    })),

  finalizeStaleActiveStream: () =>
    set((state) => {
      const activeId = state.activeStreamId
      if (!activeId) return state

      return {
        chatMessages: state.chatMessages.map((m) =>
          m.stream_id === activeId &&
          (m.status === 'streaming' ||
            m.status === 'tool_call_pending' ||
            m.status === 'awaiting_result')
            ? {
                ...m,
                status: 'interrupted',
                ended_at: m.ended_at ?? Date.now(),
              }
            : m
        ),
        activeStreamId: null,
      }
    }),

  traceEvents: [],

  addTraceEvent: (event) =>
    set((state) => ({
      traceEvents: [...state.traceEvents, event],
    })),

  clearTrace: () => set({ traceEvents: [] }),

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

  setSelectedEventId: (id) => set({ selectedEventId: id }),

  clearUiState: () =>
    set((state) => ({
      chatMessages: [],
      traceEvents: [],
      contextSnapshots: {},
      errors: [],
      selectedEventId: null,
      activeStreamId: null,
      connectionStatus: state.connectionStatus,
      lastProcessedSeq: state.lastProcessedSeq,
    })),
}))