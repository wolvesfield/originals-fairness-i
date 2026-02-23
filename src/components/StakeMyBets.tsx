import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { buildProxiedUrl, resilientFetch } from './ApiConnections'

interface StakeBet {
  serverSeedHash: string
  clientSeed: string
  nonce: number
  game: string
  createdAt?: string
  payout?: number
}

interface StakeActiveSeedPair {
  serverSeedHash: string
  clientSeed: string
  nonce: number
  previousServerSeed?: string
  previousServerSeedHash?: string
  previousNonce?: number
}

interface StakeMyBetsProps {
  onApplySeeds: (serverSeedHash: string, clientSeed: string, nonce: number, revealedSeed?: string) => void
  corsProxy?: string
}

const DEFAULT_STAKE_TOKEN = 'cf3f4d5a42f40a19ad83c94c285826a8d62d003f24260e6aa46f732bb2f681a434bacc48441c27824ab6c434776736e9'

export default function StakeMyBets({ onApplySeeds, corsProxy = 'https://corsproxy.io/?' }: StakeMyBetsProps) {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('stake_auth_token') || DEFAULT_STAKE_TOKEN)
  const [isLoading, setIsLoading] = useState(false)
  const [betHistory, setBetHistory] = useState<StakeBet[]>([])
  const [activePair, setActivePair] = useState<StakeActiveSeedPair | null>(null)
  const [error, setError] = useState<string | null>(null)

  const RAW_ENDPOINT = 'https://stake.com/_api/graphql'

  const saveToken = (token: string) => {
    setAuthToken(token)
    if (token) {
      localStorage.setItem('stake_auth_token', token)
    } else {
      localStorage.removeItem('stake_auth_token')
    }
  }

  const graphqlFetch = async (query: string, variables: Record<string, unknown> = {}, operationName?: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'x-access-token': authToken,
      'x-language': 'en',
    }
    if (operationName) headers['x-operation-name'] = operationName

    let response: Response
    try {
      response = await resilientFetch(RAW_ENDPOINT, corsProxy, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables })
      })
    } catch (fetchErr: any) {
      throw new Error(
        `Network error: ${fetchErr.message || 'All proxy routes failed'}. Go to "API Connections" → Proxy tab and try different proxies, or deploy the Cloudflare Worker from worker/ folder.`
      )
    }

    if (response.status === 403) {
      // Read body for details
      let body = ''
      try { body = await response.text() } catch {}
      const isCloudflare = body.includes('cloudflare') || body.includes('cf-') || body.includes('Just a moment')
      if (isCloudflare) {
        throw new Error(
          '403 Forbidden — Stake.com\'s Cloudflare protection is blocking the proxy. Deploy the Cloudflare Worker from worker/ folder for direct API access, or update your auth token.'
        )
      }
      throw new Error(
        `403 Forbidden — Your auth token may be expired. Get a fresh token from Stake.com DevTools (F12 → Network → x-access-token header).`
      )
    }

    if (!response.ok) {
      throw new Error(`Stake API returned HTTP ${response.status}: ${response.statusText}`)
    }

    const payload = await response.json()
    if (payload.errors?.length) {
      throw new Error(`Stake API Error: ${payload.errors.map((e: any) => e.message).join('; ')}`)
    }
    return payload.data
  }

  const fetchActiveSeedPair = async () => {
    const query = `query {
      user {
        activeServerSeed { seedHash nonce }
        activeClientSeed { seed }
        previousServerSeed { seed seedHash nonce }
      }
    }`

    const data = await graphqlFetch(query)
    const user = data?.user
    if (!user) throw new Error('Could not fetch user data — check your auth token')

    return {
      serverSeedHash: user.activeServerSeed?.seedHash ?? '',
      clientSeed: user.activeClientSeed?.seed ?? '',
      nonce: user.activeServerSeed?.nonce ?? 0,
      previousServerSeed: user.previousServerSeed?.seed,
      previousServerSeedHash: user.previousServerSeed?.seedHash,
      previousNonce: user.previousServerSeed?.nonce
    }
  }

  const fetchBetHistory = async (offset: number = 0, limit: number = 20) => {
    const query = `query HouseBetList($offset: Int, $limit: Int) {
      user {
        houseBetList(offset: $offset, limit: $limit) {
          ...BetFragment
        }
      }
    }
    fragment BetFragment on Bet {
      id
      nonce
      createdAt
      payout
      payoutMultiplier
      game { slug name }
      serverSeed { seedHash seed }
      clientSeed { seed }
    }`

    const data = await graphqlFetch(query, { offset, limit }, 'HouseBetList')
    const bets = data?.user?.houseBetList ?? []

    return bets.map((bet: any) => ({
      serverSeedHash: bet.serverSeed?.seedHash ?? '',
      revealedServerSeed: bet.serverSeed?.seed ?? undefined,
      clientSeed: bet.clientSeed?.seed ?? '',
      nonce: typeof bet.nonce === 'number' ? bet.nonce : parseInt(bet.nonce) || 0,
      game: bet.game?.slug ?? bet.game?.name ?? 'unknown',
      createdAt: bet.createdAt,
      payout: bet.payoutMultiplier ? parseFloat(bet.payoutMultiplier) : undefined
    }))
  }

  const handleFetchAll = async () => {
    if (!authToken.trim()) {
      toast.error('Enter your Stake.com auth token first')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [pair, bets] = await Promise.all([
        fetchActiveSeedPair(),
        fetchBetHistory(0, 50)
      ])

      setActivePair(pair)
      setBetHistory(bets)
      toast.success(`Fetched ${bets.length} bets and active seed pair from Stake.com`)
    } catch (err: any) {
      const msg = err.message || 'Failed to connect to Stake.com API'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyActive = () => {
    if (!activePair) return
    onApplySeeds(
      activePair.serverSeedHash,
      activePair.clientSeed,
      activePair.nonce,
      activePair.previousServerSeed || undefined
    )
    toast.success('Applied active seed pair to configuration')
  }

  const handleApplyBet = (bet: StakeBet & { revealedServerSeed?: string }) => {
    onApplySeeds(
      bet.serverSeedHash,
      bet.clientSeed,
      bet.nonce,
      bet.revealedServerSeed || undefined
    )
    toast.success(`Applied bet seed data (nonce #${bet.nonce})`)
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        🎰 Stake.com — My Bets Integration
      </h2>

      {/* Auth Token */}
      <div className="space-y-2 mb-4">
        <Label htmlFor="stake-token">Auth Token (x-access-token)</Label>
        <div className="flex gap-2">
          <Input
            id="stake-token"
            type="password"
            value={authToken}
            onChange={(e) => saveToken(e.target.value)}
            placeholder="Paste your Stake.com auth token..."
            className="font-mono text-sm flex-1"
          />
          <Button
            onClick={handleFetchAll}
            disabled={isLoading || !authToken.trim()}
            className="whitespace-nowrap"
          >
            {isLoading ? 'Fetching...' : 'Fetch My Bets'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Get from Stake.com → DevTools → Network → Copy &quot;x-access-token&quot; header. Stored locally only.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      {/* Active Seed Pair */}
      {activePair && (
        <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-emerald-400">Active Seed Pair</h3>
            <Button size="sm" variant="outline" onClick={handleApplyActive}>
              Apply to Config
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <span className="text-muted-foreground">Hash: </span>
              <span className="break-all">{activePair.serverSeedHash.slice(0, 16)}...</span>
            </div>
            <div>
              <span className="text-muted-foreground">Client: </span>
              <span>{activePair.clientSeed}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Nonce: </span>
              <span>{activePair.nonce}</span>
            </div>
          </div>
          {activePair.previousServerSeed && (
            <div className="mt-2 text-xs">
              <Badge variant="secondary" className="text-xs">Previous seed revealed</Badge>
              <span className="ml-2 font-mono text-muted-foreground break-all">
                {activePair.previousServerSeed.slice(0, 20)}...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bet History */}
      {betHistory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Recent Bets ({betHistory.length})</h3>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {betHistory.map((bet, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-secondary/50 rounded text-xs hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[10px]">
                    {bet.game}
                  </Badge>
                  <span className="font-mono text-muted-foreground">
                    N#{bet.nonce}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {bet.serverSeedHash.slice(0, 12)}...
                  </span>
                  {bet.payout !== undefined && (
                    <span className={bet.payout > 1 ? 'text-emerald-400' : 'text-red-400'}>
                      {bet.payout.toFixed(2)}x
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => handleApplyBet(bet as any)}
                >
                  Use
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!activePair && betHistory.length === 0 && !isLoading && !error && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Enter your auth token and click &quot;Fetch My Bets&quot; to pull seed data from Stake.com
        </p>
      )}
    </Card>
  )
}
