import {
  generateFloat,
  generateMinePositions,
  generateKenoNumbers,
  calculateCrashPoint,
} from '../utils/fairnessEngine'

const SERVER_SEED = 'test-server-seed-abc123'
const CLIENT_SEED = 'test-client-seed-xyz789'
const NONCE = 42

describe('generateFloat', () => {
  it('is deterministic (same inputs produce same output)', () => {
    const a = generateFloat(SERVER_SEED, CLIENT_SEED, NONCE, 0)
    const b = generateFloat(SERVER_SEED, CLIENT_SEED, NONCE, 0)
    expect(a).toBe(b)
  })
})

describe('generateMinePositions', () => {
  const totalCells = 25
  const mineCount = 3

  it('returns exactly mineCount unique positions within [0, totalCells)', () => {
    const positions = generateMinePositions(SERVER_SEED, CLIENT_SEED, NONCE, mineCount, totalCells)
    expect(positions).toHaveLength(mineCount)

    const unique = new Set(positions)
    expect(unique.size).toBe(mineCount)

    for (const pos of positions) {
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos).toBeLessThan(totalCells)
    }
  })

  it('is deterministic', () => {
    const a = generateMinePositions(SERVER_SEED, CLIENT_SEED, NONCE, mineCount, totalCells)
    const b = generateMinePositions(SERVER_SEED, CLIENT_SEED, NONCE, mineCount, totalCells)
    expect(a).toEqual(b)
  })
})

describe('generateKenoNumbers', () => {
  const count = 10
  const maxNum = 40

  it('returns exactly count unique numbers in [1, maxNum]', () => {
    const numbers = generateKenoNumbers(SERVER_SEED, CLIENT_SEED, NONCE, count, maxNum)
    expect(numbers).toHaveLength(count)

    const unique = new Set(numbers)
    expect(unique.size).toBe(count)

    for (const num of numbers) {
      expect(num).toBeGreaterThanOrEqual(1)
      expect(num).toBeLessThanOrEqual(maxNum)
    }
  })

  it('is deterministic', () => {
    const a = generateKenoNumbers(SERVER_SEED, CLIENT_SEED, NONCE, count, maxNum)
    const b = generateKenoNumbers(SERVER_SEED, CLIENT_SEED, NONCE, count, maxNum)
    expect(a).toEqual(b)
  })
})

describe('calculateCrashPoint', () => {
  it('returns a number >= 1', () => {
    const point = calculateCrashPoint(SERVER_SEED, CLIENT_SEED, NONCE)
    expect(point).toBeGreaterThanOrEqual(1)
  })

  it('is deterministic', () => {
    const a = calculateCrashPoint(SERVER_SEED, CLIENT_SEED, NONCE)
    const b = calculateCrashPoint(SERVER_SEED, CLIENT_SEED, NONCE)
    expect(a).toBe(b)
  })
})
