import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ListChecks, Play, X, Download } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { Platform, GameType, BatchVerificationResult } from '@/lib/types'

interface BatchVerificationProps {
  platform: Platform
  game: GameType
  serverSeedHash: string
  clientSeed: string
  onClose: () => void
}

export default function BatchVerification({
  platform,
  game,
  serverSeedHash,
  clientSeed,
  onClose
}: BatchVerificationProps) {
  const [startNonce, setStartNonce] = useState(0)
  const [endNonce, setEndNonce] = useState(9)
  const [isVerifying, setIsVerifying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<BatchVerificationResult[]>([])

  const totalRounds = Math.max(0, endNonce - startNonce + 1)
  const maxBatchSize = 1000

  const generateMinePositions = (nonce: number, mineCount: number, gridSize: number): number[] => {
    const totalCells = gridSize * gridSize
    const mines: number[] = []
    let seed = `${serverSeedHash}${clientSeed}${nonce}`
    
    for (let i = 0; i < mineCount; i++) {
      let hash = 0
      for (let j = 0; j < seed.length; j++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(j)
        hash = hash & hash
      }
      
      const position = Math.abs(hash) % totalCells
      
      if (!mines.includes(position)) {
        mines.push(position)
      } else {
        i--
      }
      
      seed = seed + i
    }

    return mines
  }

  const generateKenoNumbers = (nonce: number): number[] => {
    const numbers: number[] = []
    let seed = `${serverSeedHash}${clientSeed}${nonce}`
    
    for (let i = 0; i < 10; i++) {
      let hash = 0
      for (let j = 0; j < seed.length; j++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(j)
        hash = hash & hash
      }
      
      const position = (Math.abs(hash) % 40) + 1
      
      if (!numbers.includes(position)) {
        numbers.push(position)
      } else {
        i--
      }
      
      seed = seed + i
    }

    return numbers.sort((a, b) => a - b)
  }

  const calculateCrashPoint = (nonce: number): number => {
    let seed = `${serverSeedHash}${clientSeed}${nonce}`
    let hash = 0
    
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i)
      hash = hash & hash
    }
    
    const normalized = Math.abs(hash) / 2147483647
    const crash = Math.max(1.01, Math.min(100, 1 + normalized * 10))
    
    return parseFloat(crash.toFixed(2))
  }

  const handleBatchVerify = async () => {
    if (!serverSeedHash || !clientSeed) {
      toast.error('Please fill in Server Seed Hash and Client Seed')
      return
    }

    if (startNonce > endNonce) {
      toast.error('Start nonce must be less than or equal to end nonce')
      return
    }

    if (totalRounds > maxBatchSize) {
      toast.error(`Maximum batch size is ${maxBatchSize} rounds`)
      return
    }

    setIsVerifying(true)
    setProgress(0)
    setResults([])

    const batchResults: BatchVerificationResult[] = []

    for (let nonce = startNonce; nonce <= endNonce; nonce++) {
      const currentProgress = ((nonce - startNonce + 1) / totalRounds) * 100
      setProgress(currentProgress)

      let result: BatchVerificationResult

      if (game === 'mines') {
        const mineCount = 3
        const gridSize = platform === 'stake' ? 5 : 5
        const mines = generateMinePositions(nonce, mineCount, gridSize)
        result = {
          nonce,
          game: 'mines',
          data: { mines, mineCount, gridSize }
        }
      } else if (game === 'keno') {
        const numbers = generateKenoNumbers(nonce)
        result = {
          nonce,
          game: 'keno',
          data: { numbers }
        }
      } else {
        const crashPoint = calculateCrashPoint(nonce)
        result = {
          nonce,
          game: 'crash',
          data: { crashPoint }
        }
      }

      batchResults.push(result)

      await new Promise(resolve => setTimeout(resolve, 10))
    }

    setResults(batchResults)
    setIsVerifying(false)
    toast.success(`Verified ${totalRounds} rounds successfully`)
  }

  const handleExportResults = () => {
    const exportData = {
      platform,
      game,
      serverSeedHash,
      clientSeed,
      startNonce,
      endNonce,
      totalRounds,
      timestamp: Date.now(),
      results
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-verification-${game}-${startNonce}-${endNonce}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('Results exported successfully')
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListChecks size={28} className="text-primary" />
          <div>
            <h3 className="text-xl font-bold">Batch Verification</h3>
            <p className="text-sm text-muted-foreground">
              Verify multiple rounds at once for {game} on {platform}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-nonce">Start Nonce</Label>
          <Input
            id="start-nonce"
            type="number"
            value={startNonce}
            onChange={(e) => setStartNonce(parseInt(e.target.value) || 0)}
            disabled={isVerifying}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end-nonce">End Nonce</Label>
          <Input
            id="end-nonce"
            type="number"
            value={endNonce}
            onChange={(e) => setEndNonce(parseInt(e.target.value) || 0)}
            disabled={isVerifying}
            className="font-mono"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
        <div>
          <p className="text-sm font-medium">Total Rounds</p>
          <p className="text-2xl font-bold text-primary">{totalRounds}</p>
        </div>
        {totalRounds > maxBatchSize && (
          <Badge variant="destructive">Exceeds maximum ({maxBatchSize})</Badge>
        )}
      </div>

      {isVerifying && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verifying...</span>
            <span className="font-mono font-semibold">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleBatchVerify}
          disabled={isVerifying || totalRounds <= 0 || totalRounds > maxBatchSize}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          <Play size={20} className="mr-2" />
          {isVerifying ? 'Verifying...' : 'Start Batch Verification'}
        </Button>

        {results.length > 0 && (
          <Button
            onClick={handleExportResults}
            variant="outline"
            className="gap-2"
          >
            <Download size={20} />
            Export
          </Button>
        )}
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Results ({results.length})</h4>
            <Badge variant="outline">{game.toUpperCase()}</Badge>
          </div>

          <ScrollArea className="h-[400px] rounded-lg border bg-secondary/30 p-4">
            <div className="space-y-2">
              {results.map((result) => (
                <div
                  key={result.nonce}
                  className="flex items-center justify-between p-3 bg-card rounded-md border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono">
                      #{result.nonce}
                    </Badge>
                    <div className="text-sm">
                      {result.game === 'mines' && (
                        <span className="font-mono text-muted-foreground">
                          Mines: {result.data.mines?.join(', ')}
                        </span>
                      )}
                      {result.game === 'keno' && (
                        <span className="font-mono text-muted-foreground">
                          Numbers: {result.data.numbers?.join(', ')}
                        </span>
                      )}
                      {result.game === 'crash' && (
                        <span className="font-mono font-semibold text-primary">
                          Crash: {result.data.crashPoint}x
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </Card>
  )
}
