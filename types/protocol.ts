export interface TokenMessage {
  type: 'TOKEN'
  seq: number
  stream_id: string
  text: string
}

export interface ToolCallMessage {
  type: 'TOOL_CALL'
  seq: number
  stream_id: string
  call_id: string
  tool_name: string
  args: Record<string, unknown>
}

export interface ToolResultMessage {
  type: 'TOOL_RESULT'
  seq: number
  stream_id: string
  call_id: string
  result: Record<string, unknown>
}

export interface ContextSnapshotMessage {
  type: 'CONTEXT_SNAPSHOT'
  seq: number
  context_id: string
  data: Record<string, unknown>
}

export interface PingMessage {
  type: 'PING'
  seq: number
  challenge: string
}

export interface StreamEndMessage {
  type: 'STREAM_END'
  seq: number
  stream_id: string
}

export interface ErrorMessage {
  type: 'ERROR'
  seq: number
  code: string
  message: string
}

export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage

export interface UserMessageOut {
  type: 'USER_MESSAGE'
  content: string
}

export interface PongMessage {
  type: 'PONG'
  echo: string
}

export interface ResumeMessage {
  type: 'RESUME'
  last_seq: number
}

export interface ToolAckMessage {
  type: 'TOOL_ACK'
  call_id: string
}

export type ClientMessage =
  | UserMessageOut
  | PongMessage
  | ResumeMessage
  | ToolAckMessage

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'resuming'

export type StreamStatus =
  | 'idle'
  | 'streaming'
  | 'tool_call_pending'
  | 'awaiting_result'
  | 'completed'
  | 'interrupted'

export type ToolCallStatus =
  | 'pending'
  | 'acked'
  | 'resolved'
  | 'timed_out'

export interface ToolCallState {
  call_id: string
  tool_name: string
  args: Record<string, unknown>
  result: Record<string, unknown> | null
  status: ToolCallStatus
  seq: number
  result_seq: number | null
}

export interface ChatMessage {
  id: string
  stream_id: string
  tokens: string[]
  token_seqs: number[]
  tool_calls: ToolCallState[]
  status: StreamStatus
  started_at: number
  ended_at: number | null
}

export type TraceEventKind =
  | 'token_batch'
  | 'tool_call'
  | 'tool_result'
  | 'context_snapshot'
  | 'ping'
  | 'pong'
  | 'stream_end'
  | 'error'
  | 'connection'

export interface TraceEvent {
  id: string
  kind: TraceEventKind
  seq: number | null
  timestamp: number
  stream_id?: string
  call_id?: string
  summary: string
  detail: Record<string, unknown>
}

export interface ContextSnapshot {
  context_id: string
  seq: number
  data: Record<string, unknown>
  timestamp: number
}