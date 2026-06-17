import type { ServerMessage, ClientMessage } from '@/types/protocol'
import { SeqBuffer } from './seq-buffer'

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'resuming'

export type StatusChangeHandler = (status: ConnectionStatus) => void
export type MessageHandler = (msg: ServerMessage) => void

const BACKOFF_BASE_MS = 500
const BACKOFF_MAX_MS = 10_000
const BACKOFF_MULTIPLIER = 2

export class WSManager {
  private socket: WebSocket | null = null
  private url: string
  private seqBuffer: SeqBuffer
  private onStatusChange: StatusChangeHandler
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isIntentionallyClosed = false
  private getLastProcessedSeq: () => number

  constructor(
    url: string,
    messageHandler: MessageHandler,
    onStatusChange: StatusChangeHandler,
    getLastProcessedSeq: () => number
  ) {
    this.url = url
    this.onStatusChange = onStatusChange
    this.getLastProcessedSeq = getLastProcessedSeq
    this.seqBuffer = new SeqBuffer(messageHandler)
  }

  connect(): void {
  if (
    this.socket &&
    (this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }

  this.isIntentionallyClosed = false
  this.createSocket()
}

  disconnect(): void {
    this.isIntentionallyClosed = true
    this.clearReconnectTimer()
    this.socket?.close()
    this.socket = null
    this.onStatusChange('disconnected')
  }

  send(msg: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg))
    }
  }

  resetBuffer(): void {
    this.seqBuffer.reset()
  }

  private createSocket(): void {
     if (
    this.socket &&
    (this.socket.readyState === WebSocket.OPEN ||
      this.socket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }
    this.onStatusChange('connecting')

    try {
      this.socket = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.socket.onopen = () => {
      this.onStatusChange('connected')
      this.reconnectAttempts = 0

      const lastSeq = this.getLastProcessedSeq()

      if (lastSeq > 0) {
        this.onStatusChange('resuming')
        this.seqBuffer.resetForResume(lastSeq)
        this.send({ type: 'RESUME', last_seq: lastSeq })
        this.onStatusChange('connected')
      }
    }

    this.socket.onmessage = (event: MessageEvent) => {
        let msg: unknown

        try {
            msg = JSON.parse(event.data as string)
             console.log('[WSManager] TOOL_CALL received', {
                seq: msg.seq,
                stream_id: msg.stream_id,
                call_id: msg.call_id,
                tool_name: msg.tool_name,
            })
        } catch {
            console.warn('[WSManager] Malformed JSON received:', event.data)
            return
        }

        if (!isServerMessage(msg)) {
            console.warn('[WSManager] Unknown message shape:', msg)
            return
        }

        if (msg.type === 'PING') {
            const echo = typeof msg.challenge === 'string' ? msg.challenge : ''
            this.send({ type: 'PONG', echo })
        }
        if(msg.type=="STREAM_END"){
            console.log('[WSManager] STREAM_END received', {
                seq: msg.seq,
                stream_id: msg.stream_id,
            })
        }

        this.seqBuffer.push(msg)
        console.log('WS IN', msg.type, msg.seq)
        }

    this.socket.onclose = () => {
      if (this.isIntentionallyClosed) return
      this.scheduleReconnect()
    }

    this.socket.onerror = () => {
      this.onStatusChange('reconnecting')
    }
  }

  private scheduleReconnect(): void {
    this.onStatusChange('reconnecting')
    this.clearReconnectTimer()

    const delay = Math.min(
      BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempts),
      BACKOFF_MAX_MS
    )

    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(() => {
      this.createSocket()
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isServerMessage(msg: any): msg is ServerMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof msg.type === 'string' &&
    [
      'TOKEN',
      'TOOL_CALL',
      'TOOL_RESULT',
      'CONTEXT_SNAPSHOT',
      'PING',
      'STREAM_END',
      'ERROR',
    ].includes(msg.type)
  )
}