import { useEffect, useMemo, useState } from 'react'
import { useKV } from '@/hooks/useKV'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { GridFour, NumberSquareEight, TrendUp, ListChecks, Plugs } from '@phosphor-icons/react'
import type { Platform, GameType, VerificationResult } from '@/lib/types'
import ConfigPanel from '@/components/ConfigPanel'
import ServerSeedReveal from '@/components/ServerSeedReveal'
import MinesGame from '@/components/MinesGame'
import StakeMyBets from '@/components/StakeMyBets'
import SeedHistory from '@/components/SeedHistory'
import ApiConnections from '@/components/ApiConnections'
import type { ApiConfig } from '@/components/ApiConnections'
import GameResultRecorder from '@/components/GameResultRecorder'
import { GoldPathHUD } from '@/components/GoldPathHUD'
import { FutureChainSidebar } from '@/components/FutureChainSidebar'
import { MinesGrid } from '@/components/MinesGrid'
import SeedOptimizerPanel from '@/components/SeedOptimizerPanel'
import { MasterController } from '@/controllers/MasterController'
import type { GameRoundResult, ApexScanResult, AnalysisModeResult } from '@/controllers/MasterController'
import { generateMinePositions } from '@/utils/fairnessEngine'
import { getGameResults } from '@/db/browserDb'
import { addSeedHistoryEntry } from '@/db/browserDb'

type AppTab = 'mines' | 'apex' | 'history'

interface FuturePrediction {
  nonce: number
  confidence: number
  isGold: boolean
}

function App() {
  const [platform, setPlatform] = useState<Platform>('stake')
  const [activeTab, setActiveTab] = useState<AppTab>('mines')
  const [verifications, setVerifications] = useKV<VerificationResult[]>('verification-history', [])
  const [scannerResult, setScannerResult] = useKV<any>('scanner-result', { found: false })
  const [confidence, setConfidence] = useKV<number>('confidence', 0)
  const [hashStatus, setHashStatus] = useKV<string>('hash-status', 'UNKNOWN')
  const [futurePredictions, setFuturePredictions] = useKV<any[]>('future-predictions', [])
  const [heatMap, setHeatMap] = useKV<number[]>('heat-map', new Array(25).fill(0))

  const masterController = useMemo(() => new MasterController(), [])

  const [serverSeedHash, setServerSeedHash] = useState('')
  const [revealedServerSeed, setRevealedServerSeed] = useState<string | null>(null)
  const [clientSeed, setClientSeed] = useState('')
  const [nonce, setNonce] = useState(0)
  const [mineCount, setMineCount] = useState(3)
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'complete'>('idle')
  const [analysisResult, setAnalysisResult] = useState<GameRoundResult | null>(null)
  const [apexResult, setApexResult] = useState<ApexScanResult | null>(null)
  const [selectedApexOption, setSelectedApexOption] = useState<number>(0)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    stakeToken: localStorage.getItem('stake_auth_token') || '',
    stakeLockdownToken: localStorage.getItem('stake_lockdown_token') || '',
    stakeCookie: localStorage.getItem('stake_cookie') || '',
    hashesApiKey: localStorage.getItem('hashes_api_key') || '',
    corsProxy: localStorage.getItem('cors_proxy') || 'https://fairness-cors-proxy.farhan-097.workers.dev/?url=',
  })

  const totalCells = platform === 'roobet' ? 64 : 25
  const gridSize = platform === 'roobet' ? 8 : 5
  const [userTargetTiles, setUserTargetTiles] = useState<number[]>([])
  const defaultTargetTiles = platform === 'roobet'
    ? Array.from({ length: 16 }, (_, i) => i)
    : [0, 1, 2, 3, 4]
  // Use user-painted tiles if any, otherwise fall back to defaults
  const targetTiles = userTargetTiles.length > 0 ? userTargetTiles : defaultTargetTiles
  const probabilisticHeatmapReady = (heatMap ?? []).some((v: number) => v > 0)

  // Apply seeds from bookmarklet: open app with #stake=<base64(json)>
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (!hash.startsWith('#stake=')) return
    try {
      const payload = decodeURIComponent(hash.slice(7))
      const data = JSON.parse(atob(payload)) as { hash?: string; client?: string; nonce?: number }
      if (data.hash) setServerSeedHash(data.hash)
      if (data.client != null) setClientSeed(data.client)
      if (typeof data.nonce === 'number') setNonce(data.nonce)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    } catch { /* ignore */ }
  }, [])

  const handleVerify = (game: GameType) => {
    const result: VerificationResult = {
      platform,
      game,
      serverSeedHash,
      clientSeed,
      nonce,
      timestamp: Date.now()
    }

    setVerifications((current) => {
      const updated = current ? [result, ...current] : [result]
      return updated.slice(0, 50)
    })
  }

  const handleAnalyze = async (overrideSeed?: string) => {
    setAnalysisState('analyzing')
    setHashStatus('SEARCHING')

    const seedToUse = overrideSeed || revealedServerSeed || undefined

    // Grab manual game history to fuel the Probabilistic Markov Chain if no deterministic seed exists
    const recentGames = await getGameResults(100)
    const historyArray = recentGames
      .filter(g => g.gameType === 'mines' && g.minesFound)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) // chronological
      .map(g => g.minesFound!.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)))

    const result = await masterController.processGameRound(
      serverSeedHash || 'unknown',
      clientSeed || 'default-client-seed',
      nonce,
      100,
      targetTiles,
      mineCount,
      seedToUse,
      totalCells,
      historyArray
    )

    setAnalysisResult(result)
    setAnalysisState('complete')
    setScannerResult(result)
    setConfidence(result.confidence)
    setHashStatus(result.mode === 'DETERMINISTIC' ? 'CRACKED' : 'UNKNOWN')

    // Auto-set revealed seed if backend resolved it
    if (result.crackedSeed) {
      setRevealedServerSeed(result.crackedSeed)
    }

    if (result.heatMap?.length === totalCells) {
      setHeatMap(result.heatMap)
    } else {
      const baseHeatMap = new Array(totalCells).fill(0.22)
      if (result.safePath?.length) {
        result.safePath.forEach((index: number) => {
          if (index >= 0 && index < baseHeatMap.length) {
            baseHeatMap[index] = 0.05
          }
        })
      }
      setHeatMap(baseHeatMap)
    }

    // Run Apex scan if we have a revealed seed
    const effectiveSeed = result.crackedSeed || seedToUse
    if (effectiveSeed) {
      const apex = masterController.apexScan(
        effectiveSeed,
        clientSeed || 'default-client-seed',
        nonce,
        targetTiles,
        mineCount,
        totalCells,
        3
      )
      setApexResult(apex)
      setSelectedApexOption(0)
    }

    const predictions: FuturePrediction[] = Array.from({ length: 50 }, (_, i) => {
      const predictionNonce = nonce + i + 1
      if (result.crackedSeed) {
        const mines = generateMinePositions(
          result.crackedSeed,
          clientSeed || 'default-client-seed',
          predictionNonce,
          mineCount,
          totalCells
        )
        const isGold = !targetTiles.some(tile => mines.includes(tile))
        return {
          nonce: predictionNonce,
          confidence: isGold ? 0.999 : 0,
          isGold
        }
      }

      // Without revealed seed: show exact combinatorial base rate
      // P(all k tiles safe) = Product((totalCells - mineCount - i) / (totalCells - i)) for i=0..k-1
      let allSafeProb = 1
      for (let j = 0; j < targetTiles.length; j++) {
        allSafeProb *= (totalCells - mineCount - j) / (totalCells - j)
      }
      allSafeProb = Math.max(0, allSafeProb)
      return {
        nonce: predictionNonce,
        confidence: allSafeProb,
        isGold: false // Cannot determine without seed
      }
    })

    setFuturePredictions((current) => {
      const merged = [...predictions, ...(current || [])]
      return merged.slice(0, 100)
    })

    // Save to seed history (IndexedDB)
    try {
      await addSeedHistoryEntry({
        serverSeedHash: serverSeedHash || 'unknown',
        clientSeed: clientSeed || 'default-client-seed',
        nonce,
        revealedServerSeed: result.crackedSeed || seedToUse || undefined,
        platform,
        gameType: 'mines',
        mode: result.mode,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      })
      setHistoryRefreshTrigger(prev => prev + 1)
    } catch (err) {
      console.warn('Failed to save seed history:', err)
    }
  }

  const handleManualSeedApply = (seed: string) => {
    setRevealedServerSeed(seed)
    handleAnalyze(seed)
  }

  const handleStakeApplySeeds = (hash: string, client: string, n: number, revealed?: string) => {
    setServerSeedHash(hash)
    setClientSeed(client)
    setNonce(n)
    if (revealed) {
      setRevealedServerSeed(revealed)
    }
  }

  const handleHistoryApply = (hash: string, client: string, n: number, revealed?: string) => {
    setServerSeedHash(hash)
    setClientSeed(client)
    setNonce(n)
    if (revealed) {
      setRevealedServerSeed(revealed)
    }
  }

  const handleDismissGoldPath = () => {
    setScannerResult({ found: false })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <GoldPathHUD
        scannerResult={scannerResult}
        confidence={confidence ?? 0}
        hashStatus={hashStatus as 'CRACKED' | 'SEARCHING' | 'UNKNOWN'}
        onClose={handleDismissGoldPath}
      />
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Originals Fairness Infrastructure</h1>
            <p className="text-sm text-muted-foreground mt-1">Cryptographic verification for provably fair gaming</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPlatform('stake')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${platform === 'stake'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              Stake
            </button>
            <button
              onClick={() => setPlatform('roobet')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${platform === 'roobet'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              Roobet
            </button>
          </div>
        </header>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Platform:</span>
          <Badge variant="outline" className="border-primary text-primary">
            {platform.toUpperCase()}
          </Badge>
        </div>

        <ConfigPanel
          serverSeedHash={serverSeedHash}
          setServerSeedHash={setServerSeedHash}
          clientSeed={clientSeed}
          setClientSeed={setClientSeed}
          nonce={nonce}
          setNonce={setNonce}
          mineCount={mineCount}
          setMineCount={setMineCount}
          revealedServerSeed={revealedServerSeed}
          setRevealedServerSeed={setRevealedServerSeed}
        />

        {activeTab === 'mines' && (
          <SeedOptimizerPanel
            unhashedServerSeed={revealedServerSeed}
            serverSeedHash={serverSeedHash}
            nonce={nonce}
            targetTiles={targetTiles}
            mineCount={mineCount}
            totalCells={totalCells}
            onApplySeed={setClientSeed}
          />
        )}

        <ServerSeedReveal
          serverSeedHash={serverSeedHash}
          clientSeed={clientSeed}
          analysisState={analysisState}
          analysisResult={analysisResult}
          onAnalyze={() => handleAnalyze()}
          onManualSeedApply={handleManualSeedApply}
          mineCount={mineCount}
          totalCells={totalCells}
        />

        {/* API Connections Manager */}
        <ApiConnections onConfigChange={setApiConfig} />

        {/* Stake.com My Bets Integration */}
        {platform === 'stake' && (
          <StakeMyBets onApplySeeds={handleStakeApplySeeds} corsProxy={apiConfig.corsProxy} />
        )}

        {/* Game Result Recorder */}
        <GameResultRecorder
          platform={platform}
          serverSeedHash={serverSeedHash}
          clientSeed={clientSeed}
          nonce={nonce}
          mineCount={mineCount}
          refreshTrigger={historyRefreshTrigger}
        />

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AppTab)}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="mines" className="gap-1.5 text-xs sm:text-sm">
                <GridFour size={18} />
                Mines
              </TabsTrigger>
              <TabsTrigger value="apex" className="gap-1.5 text-xs sm:text-sm">
                <TrendUp size={18} />
                Apex Scanner
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
                <ListChecks size={18} />
                History & Stats
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mines" className="mt-6">
              <MinesGame
                platform={platform}
                serverSeedHash={serverSeedHash}
                revealedServerSeed={revealedServerSeed}
                clientSeed={clientSeed}
                nonce={nonce}
                mineCount={mineCount}
                onVerify={() => handleVerify('mines')}
                analysisResult={analysisResult}
                onTargetTilesChange={setUserTargetTiles}
              />
            </TabsContent>

            <TabsContent value="apex" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Provably Fair Apex Scanner</h3>
                    <Button onClick={() => handleAnalyze()} className="bg-primary hover:bg-primary/90">
                      Start Scan
                    </Button>
                  </div>

                  {/* Apex 3 Golden Path Options */}
                  {apexResult && apexResult.options.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Top {apexResult.options.length} Golden Path Options
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {apexResult.options.map((option, idx) => (
                          <div
                            key={option.nonce}
                            onClick={() => setSelectedApexOption(idx)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedApexOption === idx
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                              : 'border-border bg-secondary/40 hover:bg-secondary/60'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant={idx === 0 ? 'default' : 'secondary'} className={idx === 0 ? 'bg-yellow-600' : ''}>
                                {idx === 0 ? '🥇 Best' : idx === 1 ? '🥈 #2' : '🥉 #3'}
                              </Badge>
                              <span className="text-xs font-mono text-muted-foreground">
                                Nonce #{option.nonce}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Target Safety:</span>
                                <span className={`font-bold ${option.targetSafetyScore === 100 ? 'text-emerald-400' :
                                  option.targetSafetyScore >= 80 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                  {option.targetSafetyScore.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Safe Tiles:</span>
                                <span className="font-mono">{option.safeTiles.length}/{totalCells}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Mines:</span>
                                <span className="font-mono text-red-400">{option.mines.join(', ')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Grid for selected option */}
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-2">
                          Grid View — Option {selectedApexOption + 1} (Nonce #{apexResult.options[selectedApexOption]?.nonce})
                        </h4>
                        <MinesGrid
                          heatMap={heatMap ?? new Array(totalCells).fill(0)}
                          isCracked={true}
                          safeTiles={apexResult.options[selectedApexOption]?.safeTiles || []}
                          gridSize={gridSize}
                          mineTiles={apexResult.options[selectedApexOption]?.mines || []}
                          mineCount={mineCount}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-md text-center">
                        <p className="text-sm font-semibold text-amber-400 mb-1">
                          No Revealed Server Seed
                        </p>
                        <p className="text-xs text-muted-foreground">
                          The Apex Scanner requires a revealed server seed to calculate exact mine positions.
                          Without it, only statistical analysis is available below.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Base rate: each tile has a <span className="font-bold text-yellow-400">{((1 - mineCount / totalCells) * 100).toFixed(1)}%</span> chance of being safe
                          ({mineCount} mines in {totalCells} cells). If you ran <strong>Run Probability Analysis</strong> on Mines, the heatmap below uses a Monte Carlo density (50k simulated rounds with the same algorithm) — not exact positions.
                        </p>
                      </div>
                      {probabilisticHeatmapReady && (
                        <MinesGrid
                          heatMap={heatMap ?? new Array(totalCells).fill(mineCount / totalCells)}
                          isCracked={false}
                          safeTiles={[]}
                          gridSize={gridSize}
                          mineTiles={[]}
                          mineCount={mineCount}
                        />
                      )}
                      <p className="text-sm text-muted-foreground text-center">
                        Click "Start Scan" with a revealed server seed to see the top 3 golden path options.
                      </p>
                    </div>
                  )}
                </div>
                <FutureChainSidebar predictions={futurePredictions as FuturePrediction[]} />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <SeedHistory
                onApplyEntry={handleHistoryApply}
                refreshTrigger={historyRefreshTrigger}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <Toaster />
    </div>
  )
}

export default App