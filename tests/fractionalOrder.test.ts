import { describe, expect, it } from 'vitest'
import { initialRank, rankBetween } from '../src/features/board/fractionalOrder'

describe('fractional ordering', () => {
  it('creates a key that sorts between two existing keys', () => {
    const first = initialRank(0, 3)
    const second = initialRank(1, 3)
    const middle = rankBetween(first, second)
    expect(first < middle).toBe(true)
    expect(middle < second).toBe(true)
  })

  it('creates keys before the first and after the last item', () => {
    const rank = initialRank(1, 4)
    expect(rankBetween(undefined, rank) < rank).toBe(true)
    expect(rankBetween(rank, undefined) > rank).toBe(true)
  })

  it('rejects reversed boundaries', () => {
    const first = initialRank(0, 3)
    const second = initialRank(1, 3)
    expect(() => rankBetween(second, first)).toThrow(/lower rank/i)
  })
})
