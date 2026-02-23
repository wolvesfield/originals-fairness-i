import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Crosshair, Eraser } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { generateKenoNumbers } from '@/utils/fairnessEngine'
import type { GameRoundResult } from '@/controllers/MasterController'

const DRAW_COUNT = 10   // Numbers drawn per round
const MAX_NUM = 40      // Number pool size (1-40)
const MAX_PICKS = 10    // Max user picks

interface KenoGameProps {
  serverSeedHash: string
  revealedServerSeed?: string | null
  clientSeed: string
  nonce: number
  onVerify: () => void
  analysisResult?: GameRoundResult | null
  onUserPicksChange?: (picks: number[]) => void
}

export default function KenoGame({
  serverSeedHash,
  revealedServerSeed,
  clientSeed,
  nonce,
  onVerify,
  analysisResult,
  onUserPicksChange
}: KenoGameProps) {
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([])
  const [userPicks, setUserPicks] = useState<number[]>([])
  const [isPicking, setIsPicking] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  // Notify parent when user picks change
  useEffect(() => {
    onUserPicksChange?.(userPicks)
  }, [userPicks, onUserPicksChange])

  // Auto-populate from backend analysis results
  useEffect(() => {
    if (!analysisResult) return

    if (analysisResult.kenoScanResults?.length) {
      const currentResult = analysisResult.kenoScanResults.find(r => r.nonce === nonce)
      if (currentResult) {
        setDrawnNumbers(currentResult.drawnNumbers)
        setIsVerified(true)
      }
    }
  }, [analysisResult, nonce])

  const togglePick = useCallback((num: number) => {
    if (!isPicking) return
    setUserPicks(prev => {
      if (prev.includes(num)) return prev.filter(n => n !== num)
      if (prev.length >= MAX_PICKS) {
        toast.warning(`Maximum ${MAX_PICKS} picks allowed`)
        return prev
      }
      return [...prev, num].sort((a, b) => a - b)
    })
  }, [isPicking])

  const handleVerify = () => {
    if (!clientSeed) {
      toast.error('Please fill in Client Seed')
      return
    }

    const seed = revealedServerSeed
    if (!seed) {
      toast.error('Server seed required — run "Analyze Game State" or provide the revealed seed')
      return
    }

    const numbers = generateKenoNumbers(seed, clientSeed, nonce, DRAW_COUNT, MAX_NUM)

    setDrawnNumbers(numbers)
    setIsVerified(true)
    onVerify()

    const hits = userPicks.filter(n => numbers.includes(n))
    if (userPicks.length > 0) {
      toast.success(`Drew ${DRAW_COUNT} numbers — ${hits.length}/${userPicks.length} of your picks hit!`)
    } else {
      toast.success(`Drew ${DRAW_COUNT} numbers: ${numbers.join(', ')}`)
    }
  }

  const hits = userPicks.filter(n => drawnNumbers.includes(n))
  const misses = userPicks.filter(n => !drawnNumbers.includes(n))

  return (
    <div className="space-y-6">
      {!revealedServerSeed && (
        <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/50 text-sm text-amber-200">
          <strong>Keno Verify needs the revealed server seed.</strong> Paste it in <strong>Configuration → Revealed Server Seed</strong> above, or in Stake tab click <strong>Load bet history</strong> → paste JSON → <strong>Use pasted data</strong> → then <strong>Apply</strong> a settled bet. Then come back and click Verify Keno.
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleVerify} className="bg-primary hover:bg-primary/90" disabled={!revealedServerSeed}>
          <Check size={20} className="mr-2" />
          Verify Keno
        </Button>
        <Button
          variant={isPicking ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsPicking(!isPicking)}
          className={isPicking ? 'bg-amber-600 hover:bg-amber-700' : ''}
        >
          <Crosshair size={16} className="mr-1" />
          {isPicking ? 'Stop Picking' : 'Pick Numbers'}
        </Button>
        {userPicks.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setUserPicks([])}>
            <Eraser size={16} className="mr-1" /> Clear Picks
          </Button>
        )}
        {userPicks.length > 0 && (
          <Badge variant="outline" className="text-amber-400 border-amber-500">
            {userPicks.length}/{MAX_PICKS} picked
          </Badge>
        )}
        <Badge variant="outline" className="text-muted-foreground">
          Draw: {DRAW_COUNT} / {MAX_NUM}
        </Badge>
      </div>

      {/* Grid */}
      <div className="flex justify-center">
        <div className="grid grid-cols-8 gap-2 max-w-3xl">
          {Array.from({ length: MAX_NUM }).map((_, index) => {
            const number = index + 1
            const isDrawn = drawnNumbers.includes(number)
            const isPicked = userPicks.includes(number)
            const isHit = isDrawn && isPicked
            const isMiss = !isDrawn && isPicked && isVerified

            let cellClass = 'bg-secondary border-border text-muted-foreground'
            if (isHit) {
              cellClass = 'bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-500/40'
            } else if (isMiss) {
              cellClass = 'bg-red-500/20 border-red-500/60 text-red-400'
            } else if (isDrawn) {
              cellClass = 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-md shadow-blue-500/30'
            } else if (isPicked) {
              cellClass = 'bg-amber-500/20 border-amber-400 text-amber-300'
            }

            return (
              <div
                key={number}
                onClick={() => togglePick(number)}
                className={`
                  aspect-square rounded-md border-2 flex items-center justify-center
                  transition-all duration-200 font-mono text-lg font-bold
                  ${cellClass}
                  ${isPicking && !isVerified ? 'cursor-pointer hover:scale-105 hover:border-amber-400' : ''}
                `}
                style={{
                  animationDelay: isVerified && isDrawn ? `${drawnNumbers.indexOf(number) * 50}ms` : '0ms'
                }}
              >
                {number}
              </div>
            )
          })}
        </div>
      </div>

      {/* Results summary */}
      {isVerified && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Drawn: <span className="text-blue-400 font-mono">{drawnNumbers.sort((a, b) => a - b).join(', ')}</span>
          </p>
          {userPicks.length > 0 && (
            <div className="flex items-center justify-center gap-4 text-sm">
              <span className="text-emerald-400 font-semibold">
                {hits.length} Hit{hits.length !== 1 ? 's' : ''}: {hits.join(', ') || 'none'}
              </span>
              <span className="text-red-400">
                {misses.length} Miss{misses.length !== 1 ? 'es' : ''}: {misses.join(', ') || 'none'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
        {userPicks.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-400 inline-block" /> Your Picks
          </span>
        )}
        {isVerified && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500 inline-block" /> Drawn
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-400 inline-block" /> Hit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/60 inline-block" /> Miss
            </span>
          </>
        )}
      </div>

      {isPicking && !isVerified && (
        <p className="text-xs text-amber-400 text-center font-medium">
          Click numbers to pick them. The scanner will evaluate nonces where your picks are in the drawn set.
        </p>
      )}
    </div>
  )
}
