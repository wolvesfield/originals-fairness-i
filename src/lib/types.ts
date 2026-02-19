export type Platform = 'stake' | 'roobet'

export type GameType = 'mines' | 'keno' | 'crash'

export type GridSize = 5 | 6 | 7 | 8

export interface GameConfig {
  serverSeedHash: string
  clientSeed: string
  nonce: number
  mineCount: number
}

export interface VerificationResult {
  platform: Platform
  game: GameType
  serverSeedHash: string
  clientSeed: string
  nonce: number
  timestamp: number
}

export interface BatchVerificationResult {
  nonce: number
  game: GameType
  data: {
    mines?: number[]
    mineCount?: number
    gridSize?: number
    numbers?: number[]
    crashPoint?: number
  }
}
