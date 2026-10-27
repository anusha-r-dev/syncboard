const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const WIDTH = 12
const MAX = BigInt(ALPHABET.length) ** BigInt(WIDTH) - 1n

function decode(rank: string): bigint {
  return rank.split('').reduce((value, character) => {
    const digit = ALPHABET.indexOf(character)
    if (digit < 0) throw new Error(`Invalid rank: ${rank}`)
    return value * BigInt(ALPHABET.length) + BigInt(digit)
  }, 0n)
}

function encode(value: bigint): string {
  if (value < 0n || value > MAX) throw new Error('Rank is outside the supported range')
  let remaining = value
  let result = ''
  while (result.length < WIDTH) {
    result = ALPHABET[Number(remaining % BigInt(ALPHABET.length))] + result
    remaining /= BigInt(ALPHABET.length)
  }
  return result
}

export function rankBetween(before?: string, after?: string): string {
  const low = before ? decode(before) : 0n
  const high = after ? decode(after) : MAX
  if (low >= high) throw new Error('The lower rank must sort before the upper rank')

  const midpoint = low + (high - low) / 2n
  if (midpoint === low || midpoint === high) {
    throw new Error('No fractional rank remains between these items')
  }
  return encode(midpoint)
}

export function initialRank(index: number, total = 100): string {
  if (index < 0 || total < 1 || index >= total) throw new Error('Invalid rank position')
  return encode((MAX / BigInt(total + 1)) * BigInt(index + 1))
}

export function ranksAfter(before: string | undefined, count: number): string[] {
  if (count < 1) return []
  const low = before ? decode(before) : 0n
  const step = (MAX - low) / BigInt(count + 1)
  if (step < 1n) throw new Error('No fractional rank remains for this batch')
  return Array.from({ length: count }, (_, index) =>
    encode(low + step * BigInt(index + 1)),
  )
}

export function compareRanks(a: { order: string }, b: { order: string }): number {
  return a.order.localeCompare(b.order)
}
