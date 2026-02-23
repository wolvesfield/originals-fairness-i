import { useState, useMemo, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Platform, GridSize } from '@/lib/types'
import { toast } from 'sonner'
import { generateMinePositions } from '@/utils/fairnessEngine'
import { ClusterVarianceAnalyzer } from '@/analysis/ClusterVarianceAnalyzer'
import type { GameRoundResult } from '@/controllers/MasterController'

interface MinesGameProps {
  platform: Platform
  serverSeedHash: string
  revealedServerSeed?: string | null
  clientSeed: string
  nonce: number
  mineCount: number
  onVerify: () => void
  analysisResult?: GameRoundResult | null
  onTargetTilesChange?: (tiles: number[]) => void
}

export default function MinesGame({
  platform,
  serverSeedHash,
  revealedServerSeed,
  clientSeed,
  nonce,
  mineCount,
  onVerify,
  analysisResult,
  onTargetTilesChange
}: MinesGameProps) {
  const [gridSize, setGridSize] = useState<GridSize>(platform === 'roobet' ? 8 : 5)
  const [verifiedMines, setVerifiedMines] = useState<number[]>([])
  const [isVerified, setIsVerified] = useState(false)
  const [probabilityMap, setProbabilityMap] = useState<number[]>([])
  const [riskTiles, setRiskTiles] = useState<number[]>([])
  const [safestTiles, setSafestTiles] = useState<number[]>([])
  const [targetTiles, setTargetTiles] = useState<number[]>([])
  const [isPainting, setIsPainting] = useState(false)
  const [isRunningProbability, setIsRunningProbability] = useState(false)

  const totalCells = gridSize * gridSize
  const cva = useMemo(() => new ClusterVarianceAnalyzer(), [])

  // Reset verified state when core inputs change
  useEffect(() => {
    setVerifiedMines([])
    setIsVerified(false)
    setProbabilityMap([])
    setRiskTiles([])
    setSafestTiles([])
    // Don't reset target tiles when inputs change — user might want to keep them
  }, [serverSeedHash, clientSeed, nonce, mineCount])

  // Propagate target tiles to parent
  useEffect(() => {
    onTargetTilesChange?.(targetTiles)
  }, [targetTiles, onTargetTilesChange])

  /** Toggle a cell as a target tile (click-to-paint) */
  const toggleTargetTile = useCallback((cellIndex: number) => {
    if (!isPainting) return
    setTargetTiles(prev => {
      if (prev.includes(cellIndex)) {
        return prev.filter(t => t !== cellIndex)
      }
      return [...prev, cellIndex]
    })
  }, [isPainting])

  // Auto-populate from backend analysis results
  useEffect(() => {
    if (!analysisResult) return

    // Deterministic: show exact mine positions from nonce scan
    if (analysisResult.mode === 'DETERMINISTIC' && analysisResult.nonceScanResults?.length) {
      const currentResult = analysisResult.nonceScanResults.find(r => r.nonce === nonce)
      if (currentResult) {
        setVerifiedMines(currentResult.mines)
        setIsVerified(true)
        setProbabilityMap([])
        setRiskTiles([])
        setSafestTiles([])
      }
    }

    // Probabilistic: show heat map + risk tiles
    if (analysisResult.heatMap?.length === totalCells) {
      setProbabilityMap(analysisResult.heatMap)
      if (analysisResult.mode === 'PROBABILISTIC') {
        setVerifiedMines([])
        setIsVerified(false)
        // Calculate risk tiles = exactly mineCount tiles with highest probability
        const sorted = analysisResult.heatMap
          .map((prob: number, idx: number) => ({ idx, prob }))
          .sort((a: { prob: number }, b: { prob: number }) => b.prob - a.prob)
        const riskCount = mineCount
        const safeCount = totalCells - mineCount
        setRiskTiles(sorted.slice(0, riskCount).map((t: { idx: number }) => t.idx))
        setSafestTiles(sorted.slice(-safeCount).map((t: { idx: number }) => t.idx))
      }
    }
  }, [analysisResult, nonce, totalCells, mineCount])

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

    setIsVerified(false)
    setVerifiedMines([])
    setIsRunningProbability(true)

    const iterations = 3
    const combinedMap = new Array(totalCells).fill(0)
    let pass = 0

    const runNextPass = () => {
      if (pass >= iterations) {
        const sorted = combinedMap
          .map((prob: number, idx: number) => ({ idx, prob }))
          .sort((a: { prob: number }, b: { prob: number }) => b.prob - a.prob)
        const riskCount = mineCount
        const safeCount = totalCells - mineCount
        setProbabilityMap([...combinedMap])
        setRiskTiles(sorted.slice(0, riskCount).map((t: { idx: number }) => t.idx))
        setSafestTiles(sorted.slice(-safeCount).map((t: { idx: number }) => t.idx))
        setIsRunningProbability(false)
        toast.success(
          `Probability analysis complete — ${riskCount} risk tiles and ${safeCount} safer tiles (${mineCount} mines in ${totalCells} cells)`
        )
        return
      }
      const seedVariant = pass === 0
        ? `${clientSeed}:${nonce}`
        : `${clientSeed}:${nonce}:${pass}`
      const heatMap = cva.generateDensityMap(totalCells, mineCount, seedVariant)
      for (let i = 0; i < totalCells; i++) {
        combinedMap[i] += heatMap[i] / iterations
      }
      pass += 1
      setTimeout(runNextPass, 0)
    }

    runNextPass()
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

        <div className="flex flex-wrap gap-2 ml-auto items-center">
          <Button
            variant={isPainting ? 'default' : 'outline'}
            onClick={() => setIsPainting(!isPainting)}
            className={isPainting ? 'bg-amber-600 hover:bg-amber-700' : ''}
            title="Click tiles on the grid to mark which ones you might pick; probability analysis uses these."
          >
            {isPainting ? 'Selecting tiles…' : 'Select tiles for analysis'}
          </Button>
          {targetTiles.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTargetTiles([])}>
              Clear ({targetTiles.length})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleRunProbability}
            disabled={isRunningProbability || !serverSeedHash || !clientSeed}
          >
            {isRunningProbability ? 'Running…' : 'Run probability analysis'}
          </Button>
          <Button
            onClick={handleVerify}
            disabled={!revealedServerSeed}
            title={revealedServerSeed ? 'Verify mine positions for this nonce' : 'Need revealed server seed — run Analyze Game State above or paste from a settled bet'}
          >
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
        {(() => {
          const baseRate = mineCount / totalCells;
          return Array.from({ length: totalCells }, (_, i) => {
            const isMine = verifiedMines.includes(i)
            const prob = probabilityMap[i] ?? 0
            const hasProb = probabilityMap.length > 0
            const isRisk = riskTiles.includes(i)
            const isSafest = safestTiles.includes(i)
            const isTarget = targetTiles.includes(i)

            let displayText: string
            let bg: string
            let textColor: string
            let glow = ''
            let icon = ''
            let label = ''
            const cursor = isPainting ? 'cursor-pointer' : 'cursor-default'

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
              const minePercent = (prob * 100).toFixed(1)
              displayText = `${minePercent}%`

              if (isTarget) {
                // User-painted target tile
                bg = 'bg-amber-600/60 border-amber-400'
                textColor = 'text-amber-200'
                icon = '🎯'
                label = 'TARGET'
                glow = 'shadow-[0_0_10px_rgba(245,158,11,0.5)]'
              } else if (isRisk) {
                bg = 'bg-red-800/60 border-red-500/50'
                textColor = 'text-red-300'
                icon = '⚠️'
                label = 'RISK'
                glow = 'shadow-[0_0_8px_rgba(239,68,68,0.4)]'
              } else if (isSafest) {
                bg = 'bg-emerald-700/50 border-emerald-500/40'
                textColor = 'text-emerald-200'
                icon = '✅'
                label = 'SAFER'
                glow = 'shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              } else {
                bg = 'bg-slate-800 border-slate-600'
                textColor = 'text-slate-300'
                icon = ''
              }
            } else {
              // No analysis yet — show target painting state
              if (isTarget) {
                bg = 'bg-amber-600/50 border-amber-400'
                textColor = 'text-amber-200'
                displayText = '🎯'
                icon = ''
                label = 'TARGET'
                glow = 'shadow-[0_0_8px_rgba(245,158,11,0.4)]'
              } else {
                bg = 'bg-slate-800 border-slate-700'
                textColor = 'text-slate-400'
                displayText = '?'
                icon = ''
              }
            }

            const tileSize = gridSize <= 5 ? 'h-16 w-full' : gridSize <= 6 ? 'h-14 w-full' : 'h-12 w-full'

            return (
              <div
                key={i}
                onClick={() => toggleTargetTile(i)}
                className={`${bg} ${glow} ${tileSize} ${cursor} flex flex-col items-center justify-center rounded-lg border transition-all duration-300 ${isPainting ? 'hover:border-amber-400/60 hover:bg-amber-900/20' : ''}`}
              >
                {icon && <span className="text-sm leading-none">{icon}</span>}
                {label && <span className="text-[8px] font-bold uppercase tracking-wide leading-none">{label}</span>}
                <span className="text-[9px] text-gray-400 leading-none">#{i}</span>
                <span className={`text-[10px] font-bold ${textColor} leading-none`}>{displayText}</span>
              </div>
            )
          })
        })()}
      </div>

      {/* Legend */}
      {(probabilityMap.length > 0 || targetTiles.length > 0) && !isVerified && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-4 text-xs flex-wrap">
            {targetTiles.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-600/60 border border-amber-400 inline-block" /> 🎯 Target Tiles ({targetTiles.length})
              </span>
            )}
            {riskTiles.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-800/60 border border-red-500/50 inline-block" /> ⚠️ Risk Tiles ({riskTiles.length})
              </span>
            )}
            {safestTiles.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-700/50 border border-emerald-500/40 inline-block" /> ✅ Safer Tiles ({safestTiles.length})
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-800 border border-slate-600 inline-block" /> Neutral
            </span>
          </div>
          {isPainting && (
            <p className="text-xs text-amber-400 font-medium">
              Click tiles to mark them as targets. The scanner will look for nonces where ALL target tiles are safe.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Based on {mineCount} mines in {totalCells} cells. Base rate: {((mineCount / totalCells) * 100).toFixed(1)}% per tile.
            {!revealedServerSeed && (
              <span className="text-amber-400 font-medium"> Without a revealed server seed, all tiles have approximately equal probability — risk tiles are based on Monte Carlo sampling variance.</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}