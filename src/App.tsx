import { useState } from 'react'
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

function App() {
  const [platform, setPlatform] = useState<Platform>('stake')
  const [activeTab, setActiveTab] = useState<GameType>('mines')
  const [verifications, setVerifications] = useKV<VerificationResult[]>('verification-history', [])
  const [showBatchVerification, setShowBatchVerification] = useState(false)

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

  return (
    <div className="min-h-screen bg-background p-6">
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

        {showBatchVerification ? (
          <BatchVerification
            platform={platform}
            game={activeTab}
            serverSeedHash={serverSeedHash}
            clientSeed={clientSeed}
            onClose={() => setShowBatchVerification(false)}
          />
        ) : (
          <>
            <div className="flex justify-end">
              <Button
                onClick={() => setShowBatchVerification(true)}
                variant="outline"
                className="gap-2 border-primary/50 hover:bg-primary/10"
              >
                <ListChecks size={20} />
                Batch Verification
              </Button>
            </div>

            <Card className="p-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as GameType)}>
            <TabsList className="grid w-full grid-cols-3">
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
          </Tabs>
        </Card>
          </>
        )}
      </div>
      <Toaster />
    </div>
  )
}

export default App
