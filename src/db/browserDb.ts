/**
 * Browser-compatible database using IndexedDB.
 * Drop-in replacement for the Node-only better-sqlite3 db.ts.
 *
 * Stores verified seeds, root hashes, and seed history for the UI.
 */

import type { VerifiedSeed } from '../lib/types'

const DB_NAME = 'originals_fairness_db'
const DB_VERSION = 2

// ---------------------------------------------------------------------------
// IndexedDB setup
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains('verified_seeds')) {
        const seedStore = db.createObjectStore('verified_seeds', { keyPath: 'id' })
        seedStore.createIndex('created_at', 'created_at', { unique: false })
      }

      if (!db.objectStoreNames.contains('root_hashes')) {
        const hashStore = db.createObjectStore('root_hashes', { keyPath: 'id' })
        hashStore.createIndex('created_at', 'created_at', { unique: false })
      }

      if (!db.objectStoreNames.contains('seed_history')) {
        const historyStore = db.createObjectStore('seed_history', { keyPath: 'id', autoIncrement: true })
        historyStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Singleton promise
let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb()
  }
  return dbPromise
}

// ---------------------------------------------------------------------------
// Verified Seeds
// ---------------------------------------------------------------------------

export async function insertVerifiedSeed(record: VerifiedSeed): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('verified_seeds', 'readwrite')
    tx.objectStore('verified_seeds').put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getRecentSeeds(limit: number): Promise<VerifiedSeed[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('verified_seeds', 'readonly')
    const store = tx.objectStore('verified_seeds')
    const index = store.index('created_at')
    const results: VerifiedSeed[] = []

    const request = index.openCursor(null, 'prev')
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor && results.length < limit) {
        results.push(cursor.value as VerifiedSeed)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function bulkInsertVerifiedSeeds(records: VerifiedSeed[]): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('verified_seeds', 'readwrite')
    const store = tx.objectStore('verified_seeds')
    for (const record of records) {
      store.put(record)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------------------------------------------------------------------------
// Root Hashes
// ---------------------------------------------------------------------------

export async function setLocalRootHash(rootHash: string, source: string = 'unknown'): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('root_hashes', 'readwrite')
    tx.objectStore('root_hashes').put({
      id: `root-${source}`,
      root_hash: rootHash,
      source,
      created_at: new Date().toISOString()
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getLatestLocalRootHash(): Promise<string | null> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('root_hashes', 'readonly')
    const index = tx.objectStore('root_hashes').index('created_at')
    const request = index.openCursor(null, 'prev')
    request.onsuccess = () => {
      const cursor = request.result
      resolve(cursor ? (cursor.value as any).root_hash : null)
    }
    request.onerror = () => reject(request.error)
  })
}

// ---------------------------------------------------------------------------
// Seed History — tracks every analysis run for the seed history panel
// ---------------------------------------------------------------------------

export interface SeedHistoryEntry {
  id?: number
  serverSeedHash: string
  clientSeed: string
  nonce: number
  revealedServerSeed?: string
  platform: string
  gameType: string
  mode: 'DETERMINISTIC' | 'PROBABILISTIC'
  confidence: number
  timestamp: string
}

export async function addSeedHistoryEntry(entry: Omit<SeedHistoryEntry, 'id'>): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('seed_history', 'readwrite')
    tx.objectStore('seed_history').add(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getSeedHistory(limit: number = 50): Promise<SeedHistoryEntry[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('seed_history', 'readonly')
    const index = tx.objectStore('seed_history').index('timestamp')
    const results: SeedHistoryEntry[] = []

    const request = index.openCursor(null, 'prev')
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor && results.length < limit) {
        results.push(cursor.value as SeedHistoryEntry)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    request.onerror = () => reject(request.error)
  })
}

export async function clearSeedHistory(): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('seed_history', 'readwrite')
    tx.objectStore('seed_history').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
