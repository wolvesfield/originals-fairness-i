import { ClusterVarianceAnalyzer } from '../analysis/ClusterVarianceAnalyzer'

const analyzer = new ClusterVarianceAnalyzer()
const TOTAL_CELLS = 25
const MINE_COUNT = 3
const BASE_SEED = 'test-seed-for-cluster'

describe('generateDensityMap', () => {
  const heatMap = analyzer.generateDensityMap(TOTAL_CELLS, MINE_COUNT, BASE_SEED)

  it('returns array of correct length', () => {
    expect(heatMap).toHaveLength(TOTAL_CELLS)
  })

  it('all probabilities are in [0, 1]', () => {
    for (const prob of heatMap) {
      expect(prob).toBeGreaterThanOrEqual(0)
      expect(prob).toBeLessThanOrEqual(1)
    }
  })
})

describe('identifyDeadZones', () => {
  it('returns valid cell indices', () => {
    const heatMap = analyzer.generateDensityMap(TOTAL_CELLS, MINE_COUNT, BASE_SEED)
    const deadZones = analyzer.identifyDeadZones(heatMap)

    for (const idx of deadZones) {
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(TOTAL_CELLS)
      expect(Number.isInteger(idx)).toBe(true)
    }
  })
})

describe('computeDistributionStats', () => {
  it('returns expected shape', () => {
    const heatMap = analyzer.generateDensityMap(TOTAL_CELLS, MINE_COUNT, BASE_SEED)
    const stats = analyzer.computeDistributionStats(heatMap)

    expect(stats).toHaveProperty('mean')
    expect(stats).toHaveProperty('stdDev')
    expect(stats).toHaveProperty('coeffOfVariation')
    expect(stats).toHaveProperty('isUniform')

    expect(typeof stats.mean).toBe('number')
    expect(typeof stats.stdDev).toBe('number')
    expect(typeof stats.coeffOfVariation).toBe('number')
    expect(typeof stats.isUniform).toBe('boolean')

    expect(stats.mean).toBeGreaterThan(0)
    expect(stats.stdDev).toBeGreaterThanOrEqual(0)
    expect(stats.coeffOfVariation).toBeGreaterThanOrEqual(0)
  })
})
