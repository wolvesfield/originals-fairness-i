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
  query MyBetHistory($offset: Int!, $limit: Int!) {
    myBetHistory(offset: $offset, limit: $limit) {
      edges {
        node {
          game
          createdAt
          nonce
          clientSeed
          activeServerSeed {
            seedHash
            hash
          }
          gameSeed {
            nonce
            clientSeed
            activeServerSeed {
              seedHash
              hash
            }
          }
          state
        }
      }
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

export class StakeApiClient {
  private readonly endpoint: string
  private readonly authToken: string

  constructor(options?: { endpoint?: string; authToken?: string }) {
    this.endpoint = options?.endpoint ?? STAKE_GRAPHQL_ENDPOINT
    this.authToken = options?.authToken ?? process.env.STAKE_AUTH_TOKEN ?? ''

    if (!this.authToken) {
      throw new Error('Missing STAKE_AUTH_TOKEN. Set environment variable STAKE_AUTH_TOKEN before querying Stake API.')
    }
  }

  async myBetHistorySeeds(cursor: StakeMyBetHistoryCursor = {}): Promise<StakeBetSeedSnapshot[]> {
    const offset = cursor.offset ?? 0
    const limit = cursor.limit ?? 20

    const body = {
      operationName: 'MyBetHistory',
      query: MY_BET_HISTORY_QUERY,
      variables: { offset, limit }
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.authToken}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Stake GraphQL request failed: ${response.status} ${response.statusText}`)
    }

    const payload = await response.json() as StakeGraphQLResponse<StakeMyBetHistoryData>

    if (payload.errors?.length) {
      throw new Error(`Stake GraphQL error: ${payload.errors.map(err => err.message).join('; ')}`)
    }

    const edges = payload.data?.myBetHistory?.edges ?? []
    return edges
      .map((edge) => edge.node)
      .filter((node): node is StakeMyBetHistoryNode => !!node)
      .map(extractSeedSnapshot)
      .filter((snapshot): snapshot is StakeBetSeedSnapshot => !!snapshot)
  }
}
