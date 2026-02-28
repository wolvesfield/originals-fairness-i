import type { IncomingMessage, ServerResponse } from 'http'
import type { VerifiedSeed } from '@/lib/types'

interface SeedsApiDb {
  bulkInsertVerifiedSeeds: (records: VerifiedSeed[]) => void
  getRecentSeeds: (limit: number) => VerifiedSeed[]
}

interface SeedsApiContext {
  req: IncomingMessage
  res: ServerResponse
  db: SeedsApiDb
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function normalizeRecord(record: any): VerifiedSeed {
  if (!record || typeof record !== 'object') {
    throw new Error('Invalid seed payload')
  }

  const serverSeed = String(record.server_seed ?? '').trim()
  const clientSeed = String(record.client_seed ?? '').trim()
  const nonce = Number(record.nonce)
  const gameType = String(record.game_type ?? '').trim()
  const resultData = typeof record.result_data === 'string'
    ? record.result_data
    : JSON.stringify(record.result_data ?? {})

  if (!serverSeed || !clientSeed || !Number.isInteger(nonce) || !gameType || !resultData) {
    throw new Error('Missing required fields in seed payload')
  }

  const id = String(record.id ?? `${gameType}-${serverSeed.slice(0, 12)}-${nonce}`)
  const createdAt = String(record.created_at ?? new Date().toISOString())

  return {
    id,
    server_seed: serverSeed,
    client_seed: clientSeed,
    nonce,
    game_type: gameType,
    result_data: resultData,
    created_at: createdAt
  }
}

export async function handleSeedsApiRequest({ req, res, db }: SeedsApiContext): Promise<void> {
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'POST') {
    const raw = await readBody(req)
    if (!raw) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Request body is required' }))
      return
    }

    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }))
      return
    }

    let records: VerifiedSeed[]
    try {
      records = (Array.isArray(payload) ? payload : [payload]).map(normalizeRecord)
    } catch (err: any) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: err.message || 'Invalid seed payload' }))
      return
    }

    try {
      db.bulkInsertVerifiedSeeds(records)
      res.statusCode = 201
      res.end(JSON.stringify({ success: true, count: records.length }))
      return
    } catch {
      res.statusCode = 500
      res.end(JSON.stringify({ error: 'Failed to insert seeds' }))
      return
    }
  }

  if (req.method === 'GET') {
    const url = new URL(req.url || '/api/seeds', `http://${req.headers.host || 'localhost'}`)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 10000)

    const rows = db.getRecentSeeds(limit)
    res.statusCode = 200
    res.end(JSON.stringify(rows))
    return
  }

  res.statusCode = 405
  res.end(JSON.stringify({ error: 'Method not allowed' }))
}
