import { describe, it, expect, vi } from 'vitest'
import { SeqBuffer } from './seq-buffer'
import type { ServerMessage, TokenMessage } from '@/types/protocol'

function makeToken(seq: number, text = `token-${seq}`): TokenMessage {
  return { type: 'TOKEN', seq, stream_id: 's_01', text }
}

describe('SeqBuffer', () => {
  it('processes single matching seq immediately', () => {
    const processor = vi.fn()
    const buf = new SeqBuffer(processor)

    buf.push(makeToken(1))

    expect(processor).toHaveBeenCalledTimes(1)
  })

  it('buffers future seq', () => {
    const processor = vi.fn()
    const buf = new SeqBuffer(processor)

    buf.push(makeToken(3))

    expect(processor).not.toHaveBeenCalled()
    expect(buf.getBufferSize()).toBe(1)
  })

  it('deduplicates processed seq', () => {
    const processor = vi.fn()
    const buf = new SeqBuffer(processor)

    buf.push(makeToken(1))
    buf.push(makeToken(1))

    expect(processor).toHaveBeenCalledTimes(1)
  })

  it('flushes out-of-order messages correctly', () => {
    const order: number[] = []
    const processor = vi.fn((msg: ServerMessage) => order.push(msg.seq))
    const buf = new SeqBuffer(processor)

    buf.push(makeToken(3))
    buf.push(makeToken(2))
    buf.push(makeToken(1))

    expect(order).toEqual([1, 2, 3])
  })

  it('handles fully reversed sequence', () => {
    const order: number[] = []
    const processor = vi.fn((msg: ServerMessage) => order.push(msg.seq))
    const buf = new SeqBuffer(processor)

    ;[5, 4, 3, 2, 1].forEach((seq) => buf.push(makeToken(seq)))

    expect(order).toEqual([1, 2, 3, 4, 5])
  })
})