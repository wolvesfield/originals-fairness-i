import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { buildProxiedUrl, resilientFetch, stakeHeaders } from './ApiConnections'

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

/** Parse pasted JSON from Stake (GraphQL response or user/bet list). No proxy/token needed. */
function parsePastedStakeJson(raw: string): { activePair: StakeActiveSeedPair | null; bets: StakeBet[] } {
  const trimmed = raw.trim()
  if (!trimmed) return { activePair: null, bets: [] }
  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    throw new Error('Invalid JSON. Paste the full Response from a stake.com request (e.g. graphql or active-bet).')
  }
  const obj = data as Record<string, unknown>
  const user = (obj?.data as Record<string, unknown>)?.user ?? obj?.user ?? obj
  if (!user || typeof user !== 'object') {
    throw new Error('No user or bet data found. Paste the Response body from Stake.com DevTools (F12 → Network → click a request → Response).')
  }
  const u = user as Record<string, unknown>
  const activeServerSeed = u?.activeServerSeed as { seedHash?: string; nonce?: number } | undefined
  const activeClientSeed = u?.activeClientSeed as { seed?: string } | undefined
  const previousServerSeed = u?.previousServerSeed as { seed?: string; seedHash?: string; nonce?: number } | undefined
  const houseBetList = (u?.houseBetList ?? obj?.houseBetList ?? []) as Array<Record<string, unknown>>
  const bets: StakeBet[] = Array.isArray(houseBetList)
    ? houseBetList.map((bet: Record<string, unknown>) => {
        const serverSeed = bet?.serverSeed as { seedHash?: string; seed?: string } | undefined
        const clientSeed = bet?.clientSeed as { seed?: string } | undefined
        const game = bet?.game as { slug?: string; name?: string } | undefined
        return {
          serverSeedHash: serverSeed?.seedHash ?? '',
          clientSeed: clientSeed?.seed ?? '',
          nonce: typeof bet?.nonce === 'number' ? bet.nonce : parseInt(String(bet?.nonce), 10) || 0,
          game: game?.slug ?? game?.name ?? 'unknown',
          createdAt: typeof bet?.createdAt === 'string' ? bet.createdAt : undefined,
          payout: bet?.payoutMultiplier != null ? parseFloat(String(bet.payoutMultiplier)) : undefined,
          revealedServerSeed: serverSeed?.seed
        }
      }).filter((b: StakeBet & { revealedServerSeed?: string }) => b.serverSeedHash || b.clientSeed)
    : []

  const hasActive = activeServerSeed?.seedHash && activeClientSeed?.seed
  const activePair: StakeActiveSeedPair | null = hasActive
    ? {
        serverSeedHash: activeServerSeed.seedHash ?? '',
        clientSeed: activeClientSeed.seed ?? '',
        nonce: typeof activeServerSeed.nonce === 'number' ? activeServerSeed.nonce : 0,
        previousServerSeed: previousServerSeed?.seed,
        previousServerSeedHash: previousServerSeed?.seedHash,
        previousNonce: previousServerSeed?.nonce
      }
    : null

  if (!activePair && bets.length === 0) {
    const hasUser = !!(u?.id || u?.activeClientSeed || u?.activeServerSeed || u?.activeCasinoBets)
    throw new Error(
      hasUser
        ? 'Found user data but no active seeds. Copy the Response from a graphql request that returns activeServerSeed and activeClientSeed (e.g. GetUser / user seed query).'
        : 'Could not find user, active seeds or bet list. Paste the full Response from a Stake.com graphql or bet request.'
    )
  }
  return { activePair, bets }
}

const DEFAULT_STAKE_TOKEN = 'cf3f4d5a42f40a19ad83c94c285826a8d62d003f24260e6aa46f732bb2f681a434bacc48441c27824ab6c434776736e9'

export default function StakeMyBets({ onApplySeeds, corsProxy = 'https://corsproxy.io/?' }: StakeMyBetsProps) {
  const [pastedJson, setPastedJson] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
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
    const headers = stakeHeaders(authToken, operationName)

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
      try { body = await response.text() } catch { /* ignore */ }
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

  const handleUsePasted = () => {
    setPasteError(null)
    setError(null)
    try {
      const { activePair: pair, bets: parsedBets } = parsePastedStakeJson(pastedJson)
      setActivePair(pair)
      setBetHistory(parsedBets)
      const count = parsedBets.length
      const hasActive = !!pair
      toast.success(hasActive && count ? `Loaded active seeds + ${count} bets` : hasActive ? 'Loaded active seeds' : `Loaded ${count} bets`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to parse pasted data'
      setPasteError(msg)
      toast.error(msg)
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        🎰 Stake.com — My Bets Integration
      </h2>

      {/* Easiest: Bookmarklets + paste — no proxy */}
      <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-4">
        <h3 className="text-sm font-semibold text-emerald-400">Get seeds from Stake (no proxy)</h3>

        <div className="rounded bg-black/30 p-3 text-sm space-y-2">
          <p className="font-medium text-white">Step 1 — Drag to bookmarks bar</p>
          <p className="text-muted-foreground text-xs">The bookmarks bar is under the browser address bar. Drag one of these links there (like saving a bookmark):</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <a
              href={typeof window !== 'undefined' ? `javascript:(function(){fetch('https://stake.com/_api/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'query{user{activeServerSeed{seedHash nonce}activeClientSeed{seed}}}'})}).then(r=>r.json()).then(d=>{var u=d&&d.data&&d.data.user;if(!u||!u.activeServerSeed){alert('Log in on stake.com first');return;}var h=u.activeServerSeed.seedHash,c=(u.activeClientSeed&&u.activeClientSeed.seed)||'',n=u.activeServerSeed.nonce||0;var p=encodeURIComponent(btoa(JSON.stringify({hash:h,client:c,nonce:n})));window.open('${(window.location.origin + window.location.pathname.replace(/\/$/, ''))}/#stake='+p,'_blank');}).catch(e=>alert('Error: '+e.message));})();` : '#'}
              className="inline-block px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium border-2 border-emerald-400"
            >
              Load active seeds
            </a>
            <a
              href={typeof window !== 'undefined' ? `javascript:(function(){var q=encodeURIComponent('query HouseBetList($offset:Int,$limit:Int){user{houseBetList(offset:$offset,limit:$limit){id nonce createdAt payout payoutMultiplier game{slug name}serverSeed{seedHash seed}clientSeed{seed}}}');fetch('https://stake.com/_api/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:decodeURIComponent(q),variables:{offset:0,limit:50}})}).then(r=>r.json()).then(d=>{if(!d.data||!d.data.user){alert('Log in on stake.com first');return;}var j=JSON.stringify(d);navigator.clipboard.writeText(j).then(function(){alert('Bet history copied! Paste it in the PASTE HERE box in the app and click Use pasted data.');}).catch(function(){prompt('Copy this JSON and paste it in the app:',j);});}).catch(e=>alert('Error: '+e.message));})();` : '#'}
              className="inline-block px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium border-2 border-sky-400"
            >
              Load bet history
            </a>
          </div>
        </div>

        <div className="rounded bg-black/30 p-3 text-sm space-y-2">
          <p className="font-medium text-white">Step 2 — On stake.com, click the bookmark</p>
          <p className="text-muted-foreground text-xs">Open stake.com, log in, then click the bookmark you saved. &quot;Load active seeds&quot; opens this app with seeds filled. &quot;Load bet history&quot; copies JSON to the clipboard.</p>
        </div>

        <div className="rounded bg-black/30 p-3 text-sm space-y-2">
          <p className="font-medium text-white">Step 3 — Paste here (the big box below)</p>
          <p className="text-muted-foreground text-xs">If you used &quot;Load bet history&quot;, press Ctrl+V (or Cmd+V) in the box below. Then click &quot;Use pasted data&quot;.</p>
          <Label className="block text-base font-bold text-emerald-300 pt-2">▼ PASTE HERE ▼</Label>
          <textarea
            value={pastedJson}
            onChange={(e) => { setPastedJson(e.target.value); setPasteError(null) }}
            placeholder="Paste JSON here (from bookmark or from DevTools → Network → graphql → Response)"
            className="w-full min-h-[120px] rounded-md border-2 border-emerald-500/50 bg-background px-3 py-2 font-mono text-xs"
            rows={5}
          />
        </div>
        {pasteError && <p className="text-xs text-red-400">{pasteError}</p>}
        <Button className="w-full sm:w-auto" onClick={handleUsePasted} disabled={!pastedJson.trim()}>
          Use pasted data
        </Button>
      </div>

      {/* Or fetch with token (needs proxy) */}
      <div className="space-y-2 mb-4">
        <Label htmlFor="stake-token">Or: Fetch with token (needs proxy in API Connections)</Label>
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
          Use <strong>Paste from Stake</strong> above (no proxy), or enter a token and click Fetch.
        </p>
      )}
    </Card>
  )
}
