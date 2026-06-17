import type { ServerMessage } from '@/types/protocol'

export type MessageProcessor = (msg: ServerMessage) => void

export class SeqBuffer {
  private nextExpectedSeq = 1
  private buffer = new Map<number, ServerMessage>()
  private processedSeqs = new Set<number>()
  private processor: MessageProcessor

  constructor(processor: MessageProcessor) {
    this.processor = processor
  }

  push(msg: ServerMessage): void {
    console.log('SEQ PUSH', msg.type, msg.seq, 'expected', this.nextExpectedSeq)

    const seq = msg.seq

    if (this.processedSeqs.has(seq)) return
    if (this.buffer.has(seq)) return

    if (seq < this.nextExpectedSeq) {
      return
    }

    if (seq === this.nextExpectedSeq) {
      this.processAndFlush(msg)
    } else {
      this.buffer.set(seq, msg)
    }
  }

  private processAndFlush(msg: ServerMessage): void {
    console.log('SEQ FLUSH', msg.type, msg.seq)

    this.processedSeqs.add(msg.seq)
    this.processor(msg)
    this.nextExpectedSeq = msg.seq + 1

    while (this.buffer.has(this.nextExpectedSeq)) {
      const next = this.buffer.get(this.nextExpectedSeq)
      if (!next) break

      this.buffer.delete(this.nextExpectedSeq)

      console.log('SEQ FLUSH', next.type, next.seq)

      this.processedSeqs.add(next.seq)
      this.processor(next)
      this.nextExpectedSeq = next.seq + 1
    }
  }

  resetForResume(lastProcessedSeq: number): void {
  this.nextExpectedSeq = lastProcessedSeq + 1
  this.buffer.clear()
  this.processedSeqs.clear()
}

  reset(): void {
    this.nextExpectedSeq = 1
    this.buffer.clear()
    this.processedSeqs.clear()
  }

  getNextExpectedSeq(): number {
    return this.nextExpectedSeq
  }

  getBufferSize(): number {
    return this.buffer.size
  }

  isProcessed(seq: number): boolean {
    return this.processedSeqs.has(seq)
  }
}