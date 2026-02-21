import { chromium, type BrowserContext, type Page } from 'playwright'
import { createHash } from 'crypto'
import { mkdirSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { createInterface } from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import { bulkInsertVerifiedSeeds } from '../src/db/db'
import type { VerifiedSeed } from '../src/lib/types'

type SeedCandidate = {
  revealedSeed: string
  commitment?: string
  clientSeed?: string
  nonce?: number
  game?: string
  sourceText?: string
}

const DEFAULT_LOGIN_URL = 'https://roobet.com/'
const DEFAULT_HISTORY_URL = 'https://roobet.com/games/history'
const STORAGE_STATE_PATH = resolve(process.cwd(), 'scripts', '.cache', 'roobet-storage-state.json')

const ROW_SELECTORS = [
  'table tbody tr',
  '[role="row"]',
  '.history-row',
  '.bet-history-row',
  '[data-testid*="history"] tr'
]

const SEED_CELL_SELECTORS = [
  '.seed-display',
  '[data-testid*="seed"]',
  '[class*="seed"]',
  '[data-test*="seed"]'
]

function parseNonce(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) ? parsed : undefined
}

function parseHexSeeds(text: string): string[] {
  const matches = text.match(/[a-fA-F0-9]{32,128}/g)
  if (!matches) return []
  return [...new Set(matches.map((value) => value.toLowerCase()))]
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function toVerifiedSeed(candidate: SeedCandidate, index: number): VerifiedSeed {
  const nonce = candidate.nonce ?? index
  const clientSeed = candidate.clientSeed?.trim() || 'unknown'
  const serverSeed = candidate.revealedSeed.trim()
  const hashBase = `${serverSeed}|${clientSeed}|${nonce}|${candidate.commitment || ''}|${candidate.game || ''}`
  const id = createHash('sha256').update(hashBase).digest('hex')

  return {
    id,
    server_seed: serverSeed,
    client_seed: clientSeed,
    nonce,
    game_type: candidate.game || 'roobet-history',
    result_data: JSON.stringify({
      revealed_seed: candidate.revealedSeed,
      game_hash: candidate.commitment,
      source: 'playwright-dom-scraper',
      source_text: candidate.sourceText,
      scraped_at: new Date().toISOString()
    }),
    created_at: new Date().toISOString()
  }
}

async function promptForManualLogin(): Promise<void> {
  const rl = createInterface({ input, output })
  try {
    await rl.question('Authenticate manually in Chromium, open history panel, then press Enter to continue... ')
  } finally {
    rl.close()
  }
}

async function ensureAuthenticatedContext(): Promise<BrowserContext> {
  mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true })
  const hasState = existsSync(STORAGE_STATE_PATH)

  const browser = await chromium.launch({ headless: hasState })
  const context = await browser.newContext(hasState ? { storageState: STORAGE_STATE_PATH } : {})
  const loginUrl = process.env.ROOBET_LOGIN_URL || DEFAULT_LOGIN_URL
  const historyUrl = process.env.ROOBET_HISTORY_URL || DEFAULT_HISTORY_URL

  const page = await context.newPage()
  await page.goto(hasState ? historyUrl : loginUrl, { waitUntil: 'domcontentloaded' })

  if (!hasState) {
    await promptForManualLogin()
    await context.storageState({ path: STORAGE_STATE_PATH })
    await page.goto(historyUrl, { waitUntil: 'domcontentloaded' })
  }

  return context
}

async function extractFromPage(page: Page): Promise<SeedCandidate[]> {
  return page.evaluate(({ rowSelectors, seedCellSelectors }) => {
    const rowsBySelector = rowSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    const uniqueRows = Array.from(new Set(rowsBySelector))

    const fallbackSeedNodes = seedCellSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)))

    const textFromElement = (element: Element): string =>
      (element.textContent || '').replace(/\s+/g, ' ').trim()

    const results: Array<{
      revealedSeed: string
      commitment?: string
      clientSeed?: string
      nonce?: number
      game?: string
      sourceText?: string
    }> = []

    const nonceRegex = /\bnonce\s*[:#]?\s*(\d+)\b/i
    const clientSeedRegex = /\bclient\s*seed\s*[:#]?\s*([a-zA-Z0-9._:-]+)\b/i
    const gameRegex = /\b(mines|keno|crash|dice|roulette|plinko|blackjack)\b/i

    const parseHex = (text: string): string[] => {
      const matches = text.match(/[a-fA-F0-9]{32,128}/g) || []
      return Array.from(new Set(matches.map((value) => value.toLowerCase())))
    }

    for (const row of uniqueRows) {
      const rowText = textFromElement(row)
      if (!rowText) continue

      const hexSeeds = parseHex(rowText)
      if (hexSeeds.length === 0) continue

      const nonceMatch = rowText.match(nonceRegex)
      const clientSeedMatch = rowText.match(clientSeedRegex)
      const gameMatch = rowText.match(gameRegex)

      const revealedSeed = hexSeeds[0]
      const commitment = hexSeeds[1]

      results.push({
        revealedSeed,
        commitment,
        clientSeed: clientSeedMatch?.[1],
        nonce: nonceMatch ? Number(nonceMatch[1]) : undefined,
        game: gameMatch?.[1]?.toLowerCase(),
        sourceText: rowText
      })
    }

    if (results.length === 0) {
      for (const node of fallbackSeedNodes) {
        const text = textFromElement(node)
        const [revealedSeed, commitment] = parseHex(text)
        if (!revealedSeed) continue

        results.push({
          revealedSeed,
          commitment,
          sourceText: text
        })
      }
    }

    return results
  }, {
    rowSelectors: ROW_SELECTORS,
    seedCellSelectors: SEED_CELL_SELECTORS
  })
}

async function run(): Promise<void> {
  const context = await ensureAuthenticatedContext()
  const page = context.pages()[0] || await context.newPage()
  const historyUrl = process.env.ROOBET_HISTORY_URL || DEFAULT_HISTORY_URL

  await page.goto(historyUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const rawCandidates = await extractFromPage(page)

  const normalized = rawCandidates
    .map((candidate) => {
      const revealedSeed = normalizeWhitespace(candidate.revealedSeed || '')
      if (!revealedSeed) return null

      const seeds = parseHexSeeds(revealedSeed)
      const canonicalSeed = seeds[0]
      if (!canonicalSeed) return null

      return {
        ...candidate,
        revealedSeed: canonicalSeed,
        commitment: candidate.commitment ? parseHexSeeds(candidate.commitment)[0] : undefined,
        clientSeed: candidate.clientSeed ? normalizeWhitespace(candidate.clientSeed) : undefined,
        nonce: parseNonce(candidate.nonce !== undefined ? String(candidate.nonce) : undefined),
        sourceText: candidate.sourceText ? normalizeWhitespace(candidate.sourceText) : undefined
      } as SeedCandidate
    })
    .filter((value): value is SeedCandidate => !!value)

  const dedup = new Map<string, SeedCandidate>()
  for (const candidate of normalized) {
    const key = `${candidate.revealedSeed}|${candidate.clientSeed || 'unknown'}|${candidate.nonce ?? 'na'}|${candidate.commitment || ''}`
    if (!dedup.has(key)) {
      dedup.set(key, candidate)
    }
  }

  const records = Array.from(dedup.values()).map(toVerifiedSeed)

  if (records.length === 0) {
    console.log('No revealed seeds found in the current history view.')
  } else {
    bulkInsertVerifiedSeeds(records)
    console.log(`Inserted ${records.length} Roobet historical seed records into SQLite.`)
  }

  await context.storageState({ path: STORAGE_STATE_PATH })
  await context.close()
}

run().catch((error) => {
  console.error('Live scraper failed:', error)
  process.exit(1)
})
