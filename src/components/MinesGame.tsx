import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Platform, GridSize } from '@/lib/types'
import { toast } from 'sonner'
import { generateMinePositions } from '@/utils/fairnessEngine'
import { ClusterVarianceAnalyzer } from '@/analysis/ClusterVarianceAnalyzer'

interface MinesGameProps {
  platform: Platform
  serverSeedHash: string
  revealedServerSeed?: string | null
  clientSeed: string
  nonce: number
  mineCount: number
  onVerify: () => void
}

export default function MinesGame({
  platform,
  serverSeedHash,
  revealedServerSeed,
  clientSeed,
  nonce,
  mineCount,
  onVerify
}: MinesGameProps) {
  const [gridSize, setGridSize] = useState<GridSize>(platform === 'roobet' ? 8 : 5)
  const [verifiedMines, setVerifiedMines] = useState<number[]>([])
  const [isVerified, setIsVerified] = useState(false)
  const [probabilityMap, setProbabilityMap] = useState<number[]>([])

  const totalCells = gridSize * gridSize
  const cva = useMemo(() => new ClusterVarianceAnalyzer(), [])

  const handleVerify = () => {
    if (!serverSeedHash || !clientSeed) {
      toast.error('Please fill in Server Seed Hash and Client Seed')
      return
    }

    if (!revealedServerSeed) {
      toast.error('Verification requires revealed server seed (validated in Server Seed Reveal panel)')
      return
    }

    if (mineCount < 1 || mineCount >= totalCells) {
      toast.error(`Mine count must be between 1 and ${totalCells - 1}`)
      return
    }

    const mines = generateMinePositions(revealedServerSeed, clientSeed, nonce, mineCount, totalCells)
    setVerifiedMines(mines)
    setIsVerified(true)

    const heatMap = cva.generateDensityMap(totalCells, mineCount, `${clientSeed}:${nonce}`)
    setProbabilityMap(heatMap)

    onVerify()
    toast.success(`Verified with revealed seed. Mines: ${mines.join(', ')}`)
  }

  const handleRunProbability = () => {
    if (!serverSeedHash || !clientSeed) {
      toast.error('Please fill in Server Seed Hash and Client Seed')
      return
    }

    const heatMap = cva.generateDensityMap(totalCells, mineCount, `${clientSeed}:${nonce}`)
    setProbabilityMap(heatMap)
    setIsVerified(false)
    setVerifiedMines([])
    toast.success(`Probability analysis complete for ${gridSize}x${gridSize}`)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-border p-3 text-sm">
        <p>
          <strong>Mode:</strong>{' '}
          {revealedServerSeed ? 'Deterministic verification available' : 'Pre-reveal (probability only)'}
        </p>
      </div>

      <div className="flex items-center gap-4">
        {platform === 'roobet' && (
          <div className="space-y-1">
            <Label>Grid Size</Label>
            <Select
              value={String(gridSize)}
              onValueChange={(v) => {
                setGridSize(parseInt(v) as GridSize)
                setVerifiedMines([])
                setIsVerified(false)
                setProbabilityMap([])
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5×5</SelectItem>
                <SelectItem value="6">6×6</SelectItem>
                <SelectItem value="7">7×7</SelectItem>
                <SelectItem value="8">8×8</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={handleRunProbability}>
            Run Probability Analysis
          </Button>
          <Button onClick={handleVerify} disabled={!revealedServerSeed}>
            Verify Mines
          </Button>
        </div>
      </div>

      <div
        className="grid gap-1 mx-auto"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          maxWidth: gridSize <= 5 ? '400px' : gridSize <= 6 ? '480px' : '560px'
        }}
      >
        {Array.from({ length: totalCells }, (_, i) => {
          const isMine = verifiedMines.includes(i)
          const prob = probabilityMap[i] ?? 0
          const hasProb = probabilityMap.length > 0
          const safePercent = hasProb ? (1 - prob) * 100 : 0

          let displayText: string
          let bg: string
          let textColor: string
          let glow = ''
          let icon = ''

          if (isVerified) {
            if (isMine) {
              icon = '💣'
              bg = 'bg-red-700/80 border-red-500'
              textColor = 'text-red-200'
              displayText = 'MINE'
            } else {
              icon = '💎'
              bg = 'bg-emerald-600/80 border-emerald-400'
              textColor = 'text-emerald-100'
              glow = 'shadow-[0_0_10px_rgba(16,185,129,0.5)]'
              displayText = 'SAFE'
            }
          } else if (hasProb) {
            displayText = `${safePercent.toFixed(1)}%`
            if (safePercent >= 90) {
              bg = 'bg-emerald-600/60 border-emerald-500/50'
              textColor = 'text-emerald-100'
              glow = 'shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse'
              icon = '💎'
            } else if (safePercent >= 75) {
              bg = 'bg-emerald-700/40 border-emerald-600/30'
              textColor = 'text-emerald-200'
              icon = '✅'
            } else if (safePercent >= 60) {
              bg = 'bg-yellow-700/40 border-yellow-600/30'
              textColor = 'text-yellow-200'
              icon = '⚠️'
            } else if (safePercent >= 40) {
              bg = 'bg-orange-700/40 border-orange-600/30'
              textColor = 'text-orange-200'
              icon = '⚠️'
            } else {
              bg = 'bg-red-800/50 border-red-600/30'
              textColor = 'text-red-300'
              icon = '💣'
            }
          } else {
            bg = 'bg-slate-800 border-slate-700'
            textColor = 'text-slate-400'
            displayText = '?'
            icon = ''
          }

          const tileSize = gridSize <= 5 ? 'h-16 w-full' : gridSize <= 6 ? 'h-14 w-full' : 'h-12 w-full'

          return (
            <div
              key={i}
              className={`${bg} ${glow} ${tileSize} flex flex-col items-center justify-center rounded-lg border transition-all duration-300`}
            >
              {icon && <span className="text-sm leading-none">{icon}</span>}
              <span className="text-[9px] text-gray-400 leading-none">#{i}</span>
              <span className={`text-[10px] font-bold ${textColor} leading-none`}>{displayText}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}