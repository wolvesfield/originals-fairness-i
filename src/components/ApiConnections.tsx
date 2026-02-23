import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

/* ─── types ─── */
export type ConnectionStatus = 'untested' | 'testing' | 'active' | 'error'

export interface ApiConfig {
  stakeToken: string
  stakeLockdownToken: string
  stakeCookie: string
  hashesApiKey: string
  corsProxy: string
}

interface ApiConnectionsProps {
  onConfigChange: (config: ApiConfig) => void
}

/* ─── storage helpers ─── */
const STORAGE_KEY = 'api_connections_config'

function loadConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultConfig(), ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaultConfig()
}

function saveConfig(config: ApiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  // persist individual keys so other components can read them
  if (config.stakeToken) localStorage.setItem('stake_auth_token', config.stakeToken)
  if (config.stakeLockdownToken) localStorage.setItem('stake_lockdown_token', config.stakeLockdownToken)
  if (config.stakeCookie) localStorage.setItem('stake_cookie', config.stakeCookie)
  if (config.hashesApiKey) localStorage.setItem('hashes_api_key', config.hashesApiKey)
  if (config.corsProxy) localStorage.setItem('cors_proxy', config.corsProxy)
}

const DEFAULT_HASHES_KEY = '94b5b9c73e8a71fd34f7e12abea2e919'
const DEFAULT_CORS_PROXY = 'https://fairness-cors-proxy.farhan-097.workers.dev/?url='

function defaultConfig(): ApiConfig {
  return {
    stakeToken: localStorage.getItem('stake_auth_token') || '',
    stakeLockdownToken: localStorage.getItem('stake_lockdown_token') || '',
    stakeCookie: localStorage.getItem('stake_cookie') || '',
    hashesApiKey: localStorage.getItem('hashes_api_key') || DEFAULT_HASHES_KEY,
    corsProxy: localStorage.getItem('cors_proxy') || DEFAULT_CORS_PROXY,
  }
}

/* ─── status badge ─── */
function StatusBadge({ status, detail }: { status: ConnectionStatus; detail?: string }) {
  const variants: Record<ConnectionStatus, { label: string; cls: string }> = {
    untested: { label: 'Not Tested', cls: 'bg-gray-600 text-gray-200' },
    testing: { label: 'Testing…', cls: 'bg-yellow-600 text-yellow-100 animate-pulse' },
    active: { label: 'Active ✓', cls: 'bg-emerald-600 text-white' },
    error: { label: 'Error ✗', cls: 'bg-red-600 text-white' },
  }
  const v = variants[status]
  return (
    <div className="flex items-center gap-2">
      <Badge className={v.cls}>{v.label}</Badge>
      {detail && <span className="text-xs text-muted-foreground truncate max-w-[280px]">{detail}</span>}
    </div>
  )
}

/* ═══════════════════════════════ main component ═══════════════════════════════ */
export default function ApiConnections({ onConfigChange }: ApiConnectionsProps) {
  const [config, setConfig] = useState<ApiConfig>(loadConfig)
  const [stakeStatus, setStakeStatus] = useState<ConnectionStatus>('untested')
  const [stakeDetail, setStakeDetail] = useState<string>('')
  const [hashesStatus, setHashesStatus] = useState<ConnectionStatus>('untested')
  const [hashesDetail, setHashesDetail] = useState<string>('')
  const [proxyStatus, setProxyStatus] = useState<ConnectionStatus>('untested')
  const [proxyDetail, setProxyDetail] = useState<string>('')

  // propagate config changes up
  useEffect(() => {
    saveConfig(config)
    onConfigChange(config)
  }, [config, onConfigChange])

  const updateConfig = useCallback((patch: Partial<ApiConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  /* ── Stake test ── */
  const testStakeConnection = async () => {
    if (!config.stakeToken.trim()) {
      toast.error('Enter your Stake.com auth token first')
      return
    }
    setStakeStatus('testing')
    setStakeDetail('Sending token + lockdown + cookie…')

    try {
      const headers: Record<string, string> = stakeHeaders(config.stakeToken, 'GetUser')
      if (config.stakeLockdownToken?.trim()) headers['x-lockdown-token'] = config.stakeLockdownToken.trim()
      if (config.stakeCookie?.trim()) {
        let cookie = config.stakeCookie.trim().replace(/\s+/g, ' ')
        if (cookie.toLowerCase().startsWith('cookie:')) cookie = cookie.slice(7).trim()
        headers['x-stake-cookie'] = cookie
      }
      const res = await resilientFetch(
        'https://stake.com/_api/graphql',
        config.corsProxy,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            operationName: 'GetUser',
            query: `query GetUser { user { name balances { available { amount currency { name } } } } }`,
          }),
        }
      )

      if (!res.ok) {
        let body = ''
        try { body = await res.text() } catch { /* ignore */ }
        const isCF = /cloudflare|cf-|just a moment/i.test(body)
        const snippet = body.slice(0, 200).replace(/\s+/g, ' ')
        if (res.status === 403) {
          throw new Error(
            `STAKE_403: Stake returned 403. Response: ${snippet || '(empty)'}. Get a fresh token + lockdown + cookie from the same stake.com request and paste all 3 above. If it still fails, Stake may be blocking server IPs (try again later from same network).`
          )
        }
        throw new Error(`HTTP ${res.status}${isCF ? ' (Cloudflare)' : ''} ${res.statusText}. ${snippet ? `Body: ${snippet}` : ''}`)
      }

      const data = await res.json()
      if (data.errors?.length) throw new Error(data.errors[0].message)

      const username = data.data?.user?.name
      if (!username) throw new Error('Token invalid — no user returned')

      localStorage.setItem('stake_auth_token', config.stakeToken)

      setStakeStatus('active')
      setStakeDetail(`Logged in as: ${username}`)
      toast.success(`Stake API active — logged in as ${username}`)
    } catch (err: any) {
      const msg = err.message || 'Unknown error'
      setStakeStatus('error')

      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS') || msg.includes('proxies failed')) {
        setStakeDetail('All proxy routes failed. Try: 1) Check token validity 2) Deploy Cloudflare Worker (see worker/ folder)')
      } else if (msg.includes('403') || msg.includes('STAKE_403')) {
        setStakeDetail(msg.length > 400 ? msg.slice(0, 400) + '…' : msg)
      } else {
        setStakeDetail(msg)
      }
      toast.error(`Stake API test failed: ${msg}`)
    }
  }

  /* ── Hashes.com test ── */
  const testHashesConnection = async () => {
    if (!config.hashesApiKey.trim()) {
      toast.error('Enter your Hashes.com API key first')
      return
    }
    setHashesStatus('testing')
    setHashesDetail('')

    try {
      // Use a known SHA-256 hash of "test" to verify the key works
      const testHash = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
      const endpoint = buildProxiedUrl(
        `https://hashes.com/en/api/search?key=${config.hashesApiKey}&hash=${testHash}`,
        config.corsProxy
      )

      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)

      const data = await res.json()

      if (data.success === false && data.error) throw new Error(data.error)

      setHashesStatus('active')
      setHashesDetail(`API key valid — credits remaining: ${data.remaining ?? 'unknown'}`)
      toast.success('Hashes.com API key verified')
    } catch (err: any) {
      const msg = err.message || 'Unknown error'
      setHashesStatus('error')
      setHashesDetail(msg)
      toast.error(`Hashes.com test failed: ${msg}`)
    }
  }

  /* ── Proxy test ── */
  const testProxy = async () => {
    if (!config.corsProxy.trim()) {
      toast.error('Enter a proxy URL first')
      return
    }
    setProxyStatus('testing')
    setProxyDetail('')

    try {
      // Probe the proxy with a simple HEAD to a known-good URL
      const testUrl = buildProxiedUrl('https://httpbin.org/get', config.corsProxy)
      const res = await fetch(testUrl, { method: 'GET' })
      if (!res.ok) throw new Error(`Proxy returned HTTP ${res.status}`)

      setProxyStatus('active')
      setProxyDetail('Proxy is reachable and forwarding requests')
      toast.success('CORS proxy is working')
    } catch (err: any) {
      const msg = err.message || 'Unknown error'
      setProxyStatus('error')
      setProxyDetail(msg)
      toast.error(`Proxy test failed: ${msg}`)
    }
  }

  /* ─── render ─── */
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        🔗 API Connections
      </h2>

      <Tabs defaultValue="stake" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="stake" className="gap-1.5 text-xs sm:text-sm">
            <span className={`h-2 w-2 rounded-full ${
              stakeStatus === 'active' ? 'bg-emerald-500' :
              stakeStatus === 'error' ? 'bg-red-500' :
              stakeStatus === 'testing' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
            }`} />
            Stake.com
          </TabsTrigger>
          <TabsTrigger value="hashes" className="gap-1.5 text-xs sm:text-sm">
            <span className={`h-2 w-2 rounded-full ${
              hashesStatus === 'active' ? 'bg-emerald-500' :
              hashesStatus === 'error' ? 'bg-red-500' :
              hashesStatus === 'testing' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
            }`} />
            Hashes.com
          </TabsTrigger>
          <TabsTrigger value="proxy" className="gap-1.5 text-xs sm:text-sm">
            <span className={`h-2 w-2 rounded-full ${
              proxyStatus === 'active' ? 'bg-emerald-500' :
              proxyStatus === 'error' ? 'bg-red-500' :
              proxyStatus === 'testing' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
            }`} />
            CORS Proxy
          </TabsTrigger>
        </TabsList>

        {/* ── Stake ── */}
        <TabsContent value="stake" className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">1. x-access-token (required)</Label>
            <StatusBadge status={stakeStatus} detail={stakeDetail} />
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={config.stakeToken}
              onChange={e => updateConfig({ stakeToken: e.target.value })}
              placeholder="Paste x-access-token from DevTools → Request Headers"
              className="font-mono text-sm flex-1"
            />
            <Button onClick={testStakeConnection} disabled={stakeStatus === 'testing'} className="whitespace-nowrap">
              {stakeStatus === 'testing' ? 'Testing…' : 'Test Connection'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Will send: token {config.stakeToken?.trim() ? '✓' : '—'}, lockdown {config.stakeLockdownToken?.trim() ? '✓' : '—'}, cookie {config.stakeCookie?.trim() ? '✓' : '—'}
          </p>

          <div className="border-t border-border pt-4 mt-4">
            <p className="text-sm font-semibold text-amber-400 mb-3">If Test fails — paste these from the SAME request (scroll down here):</p>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">2. x-lockdown-token</Label>
                <Input
                  type="password"
                  value={config.stakeLockdownToken}
                  onChange={e => updateConfig({ stakeLockdownToken: e.target.value })}
                  placeholder="Paste x-lockdown-token header value"
                  className="font-mono text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">3. Cookie (full header value)</Label>
                <textarea
                  value={config.stakeCookie}
                  onChange={e => updateConfig({ stakeCookie: e.target.value })}
                  placeholder="Right-click Cookie in Request Headers → Copy value. Paste here."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs mt-1"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Where to get them:</strong> F12 → Network → do something on stake.com → click any stake.com request → Headers → Request Headers. Copy 1) x-access-token 2) x-lockdown-token 3) Cookie (right-click → Copy value).</p>
            <p className="mt-2 text-yellow-500/80">⚠ Stored locally only. Never share.</p>
          </div>
        </TabsContent>

        {/* ── Hashes.com ── */}
        <TabsContent value="hashes" className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Hashes.com API Key</Label>
            <StatusBadge status={hashesStatus} detail={hashesDetail} />
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={config.hashesApiKey}
              onChange={e => updateConfig({ hashesApiKey: e.target.value })}
              placeholder="Paste your Hashes.com API key…"
              className="font-mono text-sm flex-1"
            />
            <Button onClick={testHashesConnection} disabled={hashesStatus === 'testing'} className="whitespace-nowrap">
              {hashesStatus === 'testing' ? 'Testing…' : 'Test Connection'}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>About:</strong> Hashes.com provides hash-to-plaintext lookups. When active, the system can attempt to crack server seed hashes for deterministic mode.</p>
            <p>Get your API key at <span className="font-mono">hashes.com/en/api</span></p>
          </div>
        </TabsContent>

        {/* ── Proxy ── */}
        <TabsContent value="proxy" className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">CORS Proxy URL</Label>
            <StatusBadge status={proxyStatus} detail={proxyDetail} />
          </div>
          <div className="flex gap-2">
            <Input
              value={config.corsProxy}
              onChange={e => updateConfig({ corsProxy: e.target.value })}
              placeholder="https://corsproxy.io/?key=YOUR_KEY&url="
              className="font-mono text-sm flex-1"
            />
            <Button onClick={testProxy} disabled={proxyStatus === 'testing'} className="whitespace-nowrap">
              {proxyStatus === 'testing' ? 'Testing…' : 'Test Proxy'}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Why a proxy?</strong> Browsers block direct API calls to different domains (CORS). A proxy forwards the request and adds the required headers.</p>
            <p className="font-medium">Preset proxies:</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'corsproxy.io', url: 'https://corsproxy.io/?' },
              { label: 'corsproxy.io (keyed)', url: 'https://corsproxy.io/?key=f02f2d8a&url=' },
              { label: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' },
              { label: 'No proxy (direct)', url: '' },
            ].map(preset => (
              <Button
                key={preset.label}
                size="sm"
                variant={config.corsProxy === preset.url ? 'default' : 'outline'}
                onClick={() => updateConfig({ corsProxy: preset.url })}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-yellow-500/80">
            ⚠ Public proxies can see your request data. For sensitive tokens, host your own proxy or use a Cloudflare Worker.
          </p>
        </TabsContent>
      </Tabs>
    </Card>
  )
}

/* ─── utility ─── */

/**
 * Build simple headers for Stake.com API requests.
 * NOTE: Forbidden headers (Origin, User-Agent, Referer, sec-ch-ua, sec-fetch-*)
 * CANNOT be set client-side — browsers silently drop them.
 * All browser-mimicking header injection happens in the Cloudflare Worker proxy
 * (see worker/cors-proxy-worker.js).
 */
export function stakeHeaders(token: string, operationName?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/graphql+json, application/json',
    'Content-Type': 'application/json',
    'x-access-token': token,
    'x-language': 'en',
  }
  if (operationName) headers['x-operation-name'] = operationName
  return headers
}

/**
 * Build a proxied URL. Different proxies expect different formats:
 * - corsproxy.io: raw URL after `?` (NOT encoded)
 * - allorigins/codetabs: encoded URL after `url=` or `quest=`
 * - Custom workers: raw URL appended
 */
export function buildProxiedUrl(targetUrl: string, proxyPrefix: string): string {
  if (!proxyPrefix) return targetUrl

  // corsproxy.io expects raw (non-encoded) URLs
  if (proxyPrefix.includes('corsproxy.io')) {
    return proxyPrefix + targetUrl
  }

  // Proxies that end with url= or quest= expect encoded URLs
  if (proxyPrefix.endsWith('url=') || proxyPrefix.endsWith('quest=')) {
    return proxyPrefix + encodeURIComponent(targetUrl)
  }

  // Custom workers / other proxies: append raw URL
  return proxyPrefix + targetUrl
}

/**
 * Multi-proxy fetch: tries the primary proxy, and if it fails with a CORS/network
 * error, falls back to alternative proxies automatically.
 */
const FALLBACK_PROXIES = [
  'https://corsproxy.io/?',
  'https://corsproxy.io/?key=f02f2d8a&url=',
  'https://proxy.cors.sh/',
  'https://thingproxy.freeboard.io/fetch/',
]

export async function resilientFetch(
  targetUrl: string,
  primaryProxy: string,
  init: RequestInit = {}
): Promise<Response> {
  // Build a list of proxies: primary first, then fallbacks (deduped)
  const allProxies = [primaryProxy, ...FALLBACK_PROXIES.filter(p => p !== primaryProxy)]
  // Only use proxies that can handle POST requests (skip GET-only proxies for POST)
  const isPost = init.method?.toUpperCase() === 'POST'
  const proxies = isPost
    ? allProxies.filter(p => !p.includes('allorigins.win') && !p.includes('codetabs.com'))
    : allProxies

  // NOTE: Forbidden headers (Origin, User-Agent, Referer, sec-fetch-*) are NOT
  // injected here — browsers silently drop them. The Cloudflare Worker proxy
  // handles all browser-mimicking header injection server-side.

  const errors: string[] = []

  for (const proxy of proxies) {
    try {
      const url = buildProxiedUrl(targetUrl, proxy)
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) })
      
      // If we got a real response (even 4xx), return it — the proxy worked
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res
      }
      // 5xx from proxy means proxy itself failed
      errors.push(`${proxy.slice(0, 35)}… → HTTP ${res.status}`)
    } catch (err: any) {
      errors.push(`${proxy.slice(0, 35)}… → ${err.message?.slice(0, 50) || 'Network error'}`)
      continue
    }
  }

  // All proxies failed — try direct (might work in Electron / extensions)
  try {
    const res = await fetch(targetUrl, { ...init, signal: AbortSignal.timeout(10000) })
    return res
  } catch {
    throw new Error(
      `All ${proxies.length} proxies failed. Errors:\n${errors.join('\n')}\n\nDeploy the Cloudflare Worker from worker/ folder for reliable access.`
    )
  }
}
