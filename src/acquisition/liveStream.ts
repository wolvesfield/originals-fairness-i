import { createHash, randomUUID } from 'crypto'
import { bulkInsertVerifiedSeeds } from '@/db/db'
import type { VerifiedSeed } from '@/lib/types'

type JsonLike = Record<string, unknown> | Array<unknown>

export interface StreamSeedEvent {
  game_hash?: string
  revealed_seed?: string
  client_seed?: string
  nonce?: number | string
  game?: string
  timestamp?: string | number
  [key: string]: unknown
}

export interface LiveStreamOptions {
  endpoint: string
  gameType?: string
  batchSize?: number
  flushIntervalMs?: number
  reconnectInitialMs?: number
  reconnectMaxMs?: number
  reconnectMultiplier?: number
  reconnectJitterRatio?: number
  webSocketFactory?: (url: string) => WebSocket
  logger?: Pick<Console, 'info' | 'warn' | 'error'>
}

const defaultOptions: Required<Omit<LiveStreamOptions, 'endpoint' | 'webSocketFactory' | 'logger'>> = {
  gameType: 'live-stream',
  batchSize: 50,
  flushIntervalMs: 3000,
  reconnectInitialMs: 1000,
  reconnectMaxMs: 30000,
  reconnectMultiplier: 2,
  reconnectJitterRatio: 0.2
}

function parseNonce(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }
  return -1
}

function tryParseJson(payload: string): unknown {
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

function collectObjects(value: unknown, output: Record<string, unknown>[]): void {
  if (!value) return

  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjects(item, output)
    }
    return
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    output.push(record)
    for (const nested of Object.values(record)) {
      collectObjects(nested, output)
    }
  }
}

function pickSeedEvents(parsed: unknown): StreamSeedEvent[] {
  const objects: Record<string, unknown>[] = []
  collectObjects(parsed, objects)

  return objects
    .filter((entry) => 'game_hash' in entry || 'revealed_seed' in entry)
    .map((entry) => entry as StreamSeedEvent)
}

function toRecord(event: StreamSeedEvent, gameType: string): VerifiedSeed {
  const revealedSeed = typeof event.revealed_seed === 'string' ? event.revealed_seed.trim() : ''
  const gameHash = typeof event.game_hash === 'string' ? event.game_hash.trim() : ''
  const serverSeed = revealedSeed || gameHash || 'unknown'
  const clientSeed = typeof event.client_seed === 'string' && event.client_seed.trim()
    ? event.client_seed.trim()
    : 'unknown'
  const nonce = parseNonce(event.nonce)
  const eventGameType = typeof event.game === 'string' && event.game.trim() ? event.game.trim() : gameType
  const timestamp = new Date().toISOString()

  const idBase = `${eventGameType}|${serverSeed}|${clientSeed}|${nonce}|${timestamp}|${randomUUID()}`
  const id = createHash('sha256').update(idBase).digest('hex')

  return {
    id,
    server_seed: serverSeed,
    client_seed: clientSeed,
    nonce,
    game_type: eventGameType,
    result_data: JSON.stringify({
      ...event,
      ingested_at: timestamp,
      source: 'websocket'
    }),
    created_at: timestamp
  }
}

export class LiveStreamIngestor {
  private readonly endpoint: string
  private readonly gameType: string
  private readonly batchSize: number
  private readonly flushIntervalMs: number
  private readonly reconnectInitialMs: number
  private readonly reconnectMaxMs: number
  private readonly reconnectMultiplier: number
  private readonly reconnectJitterRatio: number
  private readonly webSocketFactory: (url: string) => WebSocket
  private readonly logger: Pick<Console, 'info' | 'warn' | 'error'>

  private socket: WebSocket | null = null
  private flushTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private reconnectAttempt = 0
  private stopped = false
  private queue: VerifiedSeed[] = []

  constructor(options: LiveStreamOptions) {
    this.endpoint = options.endpoint
    this.gameType = options.gameType ?? defaultOptions.gameType
    this.batchSize = options.batchSize ?? defaultOptions.batchSize
    this.flushIntervalMs = options.flushIntervalMs ?? defaultOptions.flushIntervalMs
    this.reconnectInitialMs = options.reconnectInitialMs ?? defaultOptions.reconnectInitialMs
    this.reconnectMaxMs = options.reconnectMaxMs ?? defaultOptions.reconnectMaxMs
    this.reconnectMultiplier = options.reconnectMultiplier ?? defaultOptions.reconnectMultiplier
    this.reconnectJitterRatio = options.reconnectJitterRatio ?? defaultOptions.reconnectJitterRatio
    this.logger = options.logger ?? console

    const ctor = options.webSocketFactory ?? ((url: string) => {
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is not available. Provide webSocketFactory in Node environments without global WebSocket.')
      }
      return new WebSocket(url)
    })

    this.webSocketFactory = ctor
  }

  start(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return
    }
    this.stopped = false
    this.openSocket()
    this.startFlushTimer()
  }

  stop(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.flushQueue()
  }

  private openSocket(): void {
    try {
      this.socket = this.webSocketFactory(this.endpoint)
    } catch (error) {
      this.logger.error('WebSocket connection failed:', error)
      this.scheduleReconnect()
      return
    }

    this.socket.onopen = () => {
      this.reconnectAttempt = 0
      this.logger.info(`Connected to ${this.endpoint}`)
    }

    this.socket.onmessage = (event: MessageEvent<string>) => {
      this.handleMessage(event.data)
    }

    this.socket.onerror = () => {
      this.logger.warn('WebSocket error received')
    }

    this.socket.onclose = () => {
      this.socket = null
      if (!this.stopped) {
        this.scheduleReconnect()
      }
    }
  }

  private handleMessage(data: string): void {
    const parsed = tryParseJson(data)
    if (!parsed) return

    const events = pickSeedEvents(parsed)
    if (events.length === 0) return

    const records = events.map((event) => toRecord(event, this.gameType))
    this.queue.push(...records)

    if (this.queue.length >= this.batchSize) {
      this.flushQueue()
    }
  }

  private flushQueue(): void {
    if (this.queue.length === 0) return
    const batch = this.queue.splice(0, this.queue.length)
    try {
      bulkInsertVerifiedSeeds(batch)
      this.logger.info(`Inserted ${batch.length} websocket records`)
    } catch (error) {
      this.logger.error('Failed to insert websocket records:', error)
      this.queue.unshift(...batch)
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      this.flushQueue()
    }, this.flushIntervalMs)
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return

    const exponent = Math.pow(this.reconnectMultiplier, this.reconnectAttempt)
    const baseDelay = Math.min(this.reconnectInitialMs * exponent, this.reconnectMaxMs)
    const jitterWindow = baseDelay * this.reconnectJitterRatio
    const delay = Math.max(250, Math.round(baseDelay + (Math.random() * 2 - 1) * jitterWindow))

    this.reconnectAttempt += 1
    this.logger.warn(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, delay)
  }
}

export function createLiveStreamIngestor(options: LiveStreamOptions): LiveStreamIngestor {
  return new LiveStreamIngestor(options)
}
