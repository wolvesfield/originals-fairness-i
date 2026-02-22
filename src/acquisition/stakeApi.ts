export interface StakeMyBetHistoryCursor {
  offset?: number
  limit?: number
}

export interface StakeBetSeedSnapshot {
  activeServerSeedCommitment: string
  clientSeed: string
  nonce: number
  game?: string
  createdAt?: string
  raw?: unknown
}

interface StakeGraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

interface StakeMyBetHistoryNode {
  game?: string
  createdAt?: string
  state?: {
    activeServerSeed?: { seedHash?: string; hash?: string }
    gameSeed?: {
      activeServerSeed?: { seedHash?: string; hash?: string }
      clientSeed?: string
      nonce?: number | string
    }
    clientSeed?: string
    nonce?: number | string
  }
  activeServerSeed?: { seedHash?: string; hash?: string }
  gameSeed?: {
    activeServerSeed?: { seedHash?: string; hash?: string }
    clientSeed?: string
    nonce?: number | string
  }
  clientSeed?: string
  nonce?: number | string
}

interface StakeMyBetHistoryData {
  myBetHistory?: {
    edges?: Array<{ node?: StakeMyBetHistoryNode }>
  }
}

const STAKE_GRAPHQL_ENDPOINT = 'https://stake.com/_api/graphql'

const MY_BET_HISTORY_QUERY = `
  query HouseBetList($limit: Int, $offset: Int) {
    user {
      id
      houseBetList(limit: $limit, offset: $offset) {
        id
        iid
        game {
          name
          slug
          __typename
        }
        bet {
          ... on CasinoBet {
            nonce
            payout
            payoutMultiplier
            currency
            amount
            createdAt
            serverSeed {
              seedHash
              seed
              nonce
              __typename
            }
            clientSeed {
              seed
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`

function parseNonce(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) return parsed
  }

  return null
}

function extractSeedSnapshot(node: StakeMyBetHistoryNode): StakeBetSeedSnapshot | null {
  const nestedState = node.state
  const nestedGameSeed = node.gameSeed ?? nestedState?.gameSeed

  const activeCommitment =
    node.activeServerSeed?.seedHash
    ?? node.activeServerSeed?.hash
    ?? nestedGameSeed?.activeServerSeed?.seedHash
    ?? nestedGameSeed?.activeServerSeed?.hash
    ?? nestedState?.activeServerSeed?.seedHash
    ?? nestedState?.activeServerSeed?.hash

  const clientSeed =
    node.clientSeed
    ?? nestedGameSeed?.clientSeed
    ?? nestedState?.clientSeed

  const nonce =
    parseNonce(node.nonce)
    ?? parseNonce(nestedGameSeed?.nonce)
    ?? parseNonce(nestedState?.nonce)

  if (!activeCommitment || !clientSeed || nonce === null) {
    return null
  }

  return {
    activeServerSeedCommitment: activeCommitment,
    clientSeed,
    nonce,
    game: node.game,
    createdAt: node.createdAt,
    raw: node
  }
}

const BALANCE_QUERY = `
  query StakeBalances($available: Boolean = true, $vault: Boolean = false) {
    user {
      id
      balances {
        available @include(if: $available) {
          currency
          amount
          __typename
        }
        vault @include(if: $vault) {
          currency
          amount
          __typename
        }
        __typename
      }
      __typename
    }
  }
`

const ACTIVE_SEED_PAIR_QUERY = `
  query ServerSeedSettings {
    user {
      id
      activeServerSeed {
        seedHash
        nonce
        __typename
      }
      activeClientSeed {
        seed
        __typename
      }
      previousServerSeed {
        seed
        seedHash
        nonce
        __typename
      }
      __typename
    }
  }
`

export interface StakeBalance {
  currency: string
  amount: number
}

export interface StakeActiveSeedPair {
  serverSeedHash: string
  clientSeed: string
  nonce: number
  previousServerSeed?: string
  previousServerSeedHash?: string
  previousNonce?: number
}

export class StakeApiClient {
  private readonly endpoint: string
  private readonly authToken: string
  private readonly cookie: string
  private readonly userAgent: string

  constructor(options?: { endpoint?: string; authToken?: string; cookie?: string; userAgent?: string }) {
    this.endpoint = options?.endpoint ?? STAKE_GRAPHQL_ENDPOINT
    this.authToken = options?.authToken ?? process.env.STAKE_AUTH_TOKEN ?? ''
    this.cookie = options?.cookie ?? process.env.STAKE_COOKIE ?? ''
    this.userAgent = options?.userAgent ?? process.env.STAKE_USER_AGENT
      ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'

    if (!this.authToken) {
      throw new Error('Missing STAKE_AUTH_TOKEN. Set environment variable STAKE_AUTH_TOKEN before querying Stake API.')
    }
  }

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}, operationName?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: '*/*',
      'x-access-token': this.authToken,
      'x-language': 'en',
      'user-agent': this.userAgent,
      'origin': 'https://stake.com',
      'referer': 'https://stake.com/casino/games/mines',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    }
    if (operationName) headers['x-operation-name'] = operationName
    if (this.cookie) headers['cookie'] = this.cookie

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    })

    if (!response.ok) {
      throw new Error(`Stake GraphQL: ${response.status} ${response.statusText}`)
    }

    const payload = await response.json() as StakeGraphQLResponse<T>
    if (payload.errors?.length) {
      throw new Error(`Stake GraphQL error: ${payload.errors.map(e => e.message).join('; ')}`)
    }
    return payload.data as T
  }

  async getBalances(): Promise<StakeBalance[]> {
    const data = await this.graphql<any>(BALANCE_QUERY, {})
    const available = data?.user?.balances?.available ?? []
    return available.map((b: any) => ({ currency: b.currency, amount: parseFloat(b.amount) }))
  }

  async getActiveSeedPair(): Promise<StakeActiveSeedPair> {
    const data = await this.graphql<any>(ACTIVE_SEED_PAIR_QUERY, {})
    const user = data?.user
    return {
      serverSeedHash: user?.activeServerSeed?.seedHash ?? '',
      clientSeed: user?.activeClientSeed?.seed ?? '',
      nonce: user?.activeServerSeed?.nonce ?? 0,
      previousServerSeed: user?.previousServerSeed?.seed,
      previousServerSeedHash: user?.previousServerSeed?.seedHash,
      previousNonce: user?.previousServerSeed?.nonce
    }
  }

  async myBetHistorySeeds(cursor: StakeMyBetHistoryCursor = {}): Promise<StakeBetSeedSnapshot[]> {
    const offset = cursor.offset ?? 0
    const limit = cursor.limit ?? 20

    const data = await this.graphql<any>(
      MY_BET_HISTORY_QUERY,
      { offset, limit },
      'HouseBetList'
    )

    const bets = data?.user?.houseBetList ?? []
    return bets
      .map((entry: any) => {
        const inner = entry.bet ?? entry
        const seedHash = inner.serverSeed?.seedHash ?? ''
        const clientSeed = inner.clientSeed?.seed ?? ''
        const nonce = typeof inner.nonce === 'number' ? inner.nonce : parseInt(inner.nonce) || 0
        if (!seedHash || !clientSeed) return null
        return {
          activeServerSeedCommitment: seedHash,
          clientSeed,
          nonce,
          game: entry.game?.slug ?? entry.game?.name ?? 'unknown',
          createdAt: inner.createdAt,
          raw: entry
        } as StakeBetSeedSnapshot
      })
      .filter((s): s is StakeBetSeedSnapshot => s !== null)
  }
}
