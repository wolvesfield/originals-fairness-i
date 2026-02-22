import { createHash } from 'crypto'
import { getRecentSeeds } from '@/db/db'

export interface HashesComCrackResult {
  hash: string
  plaintext: string
}

export interface HashesComApiResponse {
  success?: boolean
  results?: HashesComCrackResult[]
  data?: HashesComCrackResult[]
  error?: string
}

export interface HashProgressionCheck {
  hash: string
  plaintext: string | null
  plaintextMatchesHash: boolean
  nextHashMatchesProgression: boolean | null
}

export interface HistoricalVerificationResult {
  total: number
  cracked: number
  allPlaintextMatch: boolean
  progressionIntegrity: boolean
  checks: HashProgressionCheck[]
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function normalizeHash(hash: string): string {
  return hash.replace(/^0x/i, '').trim().toLowerCase()
}

export function loadRecentServerSeedHashes(limit: number = 1000): string[] {
  const rows = getRecentSeeds(limit)
  const unique = new Set<string>()

  for (const row of rows) {
    const candidate = normalizeHash(row.server_seed)
    if (/^[a-f0-9]{32,128}$/.test(candidate)) {
      unique.add(candidate)
    }
  }

  return Array.from(unique)
}

export async function fetchHashesDotComPreimages(
  hashes: string[],
  options?: {
    apiKey?: string
    apiUrl?: string
    fetchImpl?: typeof fetch
  }
): Promise<Map<string, string>> {
  const apiKey = options?.apiKey ?? process.env.HASHES_API_KEY
  const apiUrl = options?.apiUrl ?? process.env.HASHES_API_URL ?? 'https://hashes.com/en/api/search'
  const fetchImpl = options?.fetchImpl ?? fetch

  if (!apiKey) {
    throw new Error('Missing HASHES_API_KEY environment variable.')
  }

  if (hashes.length === 0) {
    return new Map<string, string>()
  }

  const response = await fetchImpl(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ hashes })
  })

  if (!response.ok) {
    throw new Error(`Hashes API request failed: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json() as HashesComApiResponse
  const entries = payload.results ?? payload.data ?? []

  const resolved = new Map<string, string>()
  for (const entry of entries) {
    const hash = normalizeHash(entry.hash)
    const plaintext = String(entry.plaintext ?? '')
    if (!hash || !plaintext) continue
    resolved.set(hash, plaintext)
  }

  return resolved
}

export function verifyHashChainProgression(
  hashesInOrder: string[],
  cracked: Map<string, string>
): HistoricalVerificationResult {
  const normalized = hashesInOrder.map(normalizeHash)
  const checks: HashProgressionCheck[] = []

  for (let index = 0; index < normalized.length; index++) {
    const hash = normalized[index]
    const plaintext = cracked.get(hash) ?? null
    const plaintextMatchesHash = plaintext ? sha256(plaintext) === hash : false

    let nextHashMatchesProgression: boolean | null = null
    if (plaintext && index < normalized.length - 1) {
      const plaintextAsHash = normalizeHash(plaintext)
      nextHashMatchesProgression = plaintextAsHash === normalized[index + 1]
    }

    checks.push({
      hash,
      plaintext,
      plaintextMatchesHash,
      nextHashMatchesProgression
    })
  }

  const crackedCount = checks.filter((item) => item.plaintext !== null).length
  const allPlaintextMatch = checks
    .filter((item) => item.plaintext !== null)
    .every((item) => item.plaintextMatchesHash)

  const progressionIntegrity = checks
    .filter((item) => item.nextHashMatchesProgression !== null)
    .every((item) => item.nextHashMatchesProgression === true)

  return {
    total: checks.length,
    cracked: crackedCount,
    allPlaintextMatch,
    progressionIntegrity,
    checks
  }
}

export async function runHistoricalPreimageAudit(
  revealedServerSeedHashes: string[]
): Promise<HistoricalVerificationResult> {
  const cracked = await fetchHashesDotComPreimages(revealedServerSeedHashes)
  return verifyHashChainProgression(revealedServerSeedHashes, cracked)
}
