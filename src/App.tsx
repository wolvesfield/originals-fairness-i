import { useMemo, useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { GridFour, NumberSquareEight, TrendUp, ListChecks } from '@phosphor-icons/react'
import type { Platform, GameType, VerificationResult } from '@/lib/types'
import ConfigPanel from '@/components/ConfigPanel'
import ServerSeedReveal from '@/components/ServerSeedReveal'
import MinesGame from '@/components/MinesGame'
import KenoGame from '@/components/KenoGame'
import CrashGame from '@/components/CrashGame'
import BatchVerification from '@/components/BatchVerification'
import { GoldPathHUD } from '@/components/GoldPathHUD'
import { FutureChainSidebar } from '@/components/FutureChainSidebar'
import { MinesGrid } from '@/components/MinesGrid'
import { MasterController } from '@/controllers/MasterController'

type AppTab = GameType | 'batch' | 'apex'

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
  const [clientSeed, setClientSeed] = useState('')
  const [nonce, setNonce] = useState(0)
  const [mineCount, setMineCount] = useState(3)

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

  const handleStartScan = async () => {
    setHashStatus('SEARCHING')

    const result = await masterController.processGameRound(
      serverSeedHash || 'unknown',
      clientSeed || 'default-client-seed',
      nonce,
      100
    )

    setScannerResult(result)
    const resolvedConfidence = result.mode === 'DETERMINISTIC' ? 0.999 : 0.75
    setConfidence(resolvedConfidence)
    setHashStatus(result.mode === 'DETERMINISTIC' ? 'CRACKED' : 'UNKNOWN')

    const baseHeatMap = new Array(25).fill(0.22)
    if (result.safePath?.length) {
      result.safePath.forEach((index: number) => {
        if (index >= 0 && index < baseHeatMap.length) {
          baseHeatMap[index] = 0.05
        }
      })
    }
    setHeatMap(baseHeatMap)

    const predictions: FuturePrediction[] = Array.from({ length: 50 }, (_, i) => {
      const predictionNonce = nonce + i + 1
      const isGold = !!result.found && result.nonce === predictionNonce
      return {
        nonce: predictionNonce,
        confidence: isGold ? resolvedConfidence : Math.max(0.1, resolvedConfidence - 0.4 + (i % 10) * 0.01),
        isGold
      }
    })

    setFuturePredictions((current) => {
      const merged = [...predictions, ...(current || [])]
      return merged.slice(0, 100)
    })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <GoldPathHUD
        scannerResult={scannerResult}
        confidence={confidence ?? 0}
        hashStatus={hashStatus as 'CRACKED' | 'SEARCHING' | 'UNKNOWN'}
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
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                platform === 'stake'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Stake
            </button>
            <button
              onClick={() => setPlatform('roobet')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                platform === 'roobet'
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
        />

        <ServerSeedReveal serverSeedHash={serverSeedHash} />

        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AppTab)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="mines" className="gap-2">
                <GridFour size={20} />
                Mines
              </TabsTrigger>
              <TabsTrigger value="keno" className="gap-2">
                <NumberSquareEight size={20} />
                Keno
              </TabsTrigger>
              <TabsTrigger value="crash" className="gap-2">
                <TrendUp size={20} />
                Crash
              </TabsTrigger>
              <TabsTrigger value="batch" className="gap-2">
                <ListChecks size={20} />
                Batch
              </TabsTrigger>
              <TabsTrigger value="apex" className="gap-2">
                <TrendUp size={20} />
                Apex
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mines" className="mt-6">
              <MinesGame
                platform={platform}
                serverSeedHash={serverSeedHash}
                clientSeed={clientSeed}
                nonce={nonce}
                mineCount={mineCount}
                onVerify={() => handleVerify('mines')}
              />
            </TabsContent>

            <TabsContent value="keno" className="mt-6">
              <KenoGame
                serverSeedHash={serverSeedHash}
                clientSeed={clientSeed}
                nonce={nonce}
                onVerify={() => handleVerify('keno')}
              />
            </TabsContent>

            <TabsContent value="crash" className="mt-6">
              <CrashGame
                serverSeedHash={serverSeedHash}
                clientSeed={clientSeed}
                nonce={nonce}
                onVerify={() => handleVerify('crash')}
              />
            </TabsContent>

            <TabsContent value="batch" className="mt-6">
              <BatchVerification
                platform={platform}
                game={activeTab === 'batch' || activeTab === 'apex' ? 'mines' : activeTab}
                serverSeedHash={serverSeedHash}
                clientSeed={clientSeed}
                onClose={() => setActiveTab('mines')}
              />
            </TabsContent>

            <TabsContent value="apex" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Neural-Entropy Apex Scanner</h3>
                    <Button onClick={handleStartScan} className="bg-primary hover:bg-primary/90">
                      Start Scan
                    </Button>
                  </div>
                  <MinesGrid
                    heatMap={heatMap ?? new Array(25).fill(0)}
                    isCracked={hashStatus === 'CRACKED'}
                    safeTiles={scannerResult?.safePath || []}
                  />
                </div>
                <FutureChainSidebar predictions={futurePredictions as FuturePrediction[]} />
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <Toaster />
    </div>
  )
}

export default App
