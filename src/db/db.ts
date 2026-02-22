import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { resolve } from 'path'
import type { VerifiedSeed } from '../lib/types'

// ---------------------------------------------------------------------------
// Database initialization (singleton)
// ---------------------------------------------------------------------------

const dbDir = resolve(process.cwd(), 'database')
mkdirSync(dbDir, { recursive: true })

const dbPath = resolve(dbDir, 'audit_store.db')
const db: BetterSqlite3.Database = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS verified_seeds (
    id          TEXT PRIMARY KEY,
    server_seed TEXT     NOT NULL,
    client_seed TEXT     NOT NULL,
    nonce       INTEGER  NOT NULL,
    game_type   TEXT     NOT NULL,
    result_data TEXT     NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS root_hashes (
    id          TEXT PRIMARY KEY,
    root_hash   TEXT     NOT NULL,
    source      TEXT     NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
  )
`)

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const insertStmt: BetterSqlite3.Statement<VerifiedSeed> = db.prepare(`
  INSERT OR REPLACE INTO verified_seeds
    (id, server_seed, client_seed, nonce, game_type, result_data, created_at)
  VALUES
    (@id, @server_seed, @client_seed, @nonce, @game_type, @result_data, @created_at)
`)

const selectRecentStmt: BetterSqlite3.Statement<[number]> = db.prepare(
  'SELECT * FROM verified_seeds ORDER BY created_at DESC LIMIT ?'
)

const upsertRootHashStmt = db.prepare(`
  INSERT OR REPLACE INTO root_hashes (id, root_hash, source, created_at)
  VALUES (@id, @root_hash, @source, @created_at)
`)

const selectLatestRootHashStmt = db.prepare(`
  SELECT root_hash
  FROM root_hashes
  ORDER BY created_at DESC
  LIMIT 1
`)

// ---------------------------------------------------------------------------
// Exported operations
// ---------------------------------------------------------------------------

export function insertVerifiedSeed(record: VerifiedSeed): void {
  insertStmt.run(record)
}

export function getRecentSeeds(limit: number): VerifiedSeed[] {
  return selectRecentStmt.all(limit) as VerifiedSeed[]
}

const bulkInsert = db.transaction((records: VerifiedSeed[]) => {
  for (const record of records) {
    insertStmt.run(record)
  }
})

export function bulkInsertVerifiedSeeds(records: VerifiedSeed[]): void {
  bulkInsert(records)
}

export function setLocalRootHash(rootHash: string, source: string = 'unknown'): void {
  upsertRootHashStmt.run({
    id: `root-${source}`,
    root_hash: rootHash,
    source,
    created_at: new Date().toISOString()
  })
}

export function getLatestLocalRootHash(): string | null {
  const row = selectLatestRootHashStmt.get() as { root_hash: string } | undefined
  return row?.root_hash ?? null
}

export { db }
