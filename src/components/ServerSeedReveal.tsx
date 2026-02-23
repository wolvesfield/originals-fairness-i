import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Lightning, CircleNotch, Brain, CaretDown, CaretUp } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { GameRoundResult } from '@/controllers/MasterController'

interface ServerSeedRevealProps {
  serverSeedHash: string
  clientSeed: string
  analysisState: 'idle' | 'analyzing' | 'complete'
  analysisResult: GameRoundResult | null
  onAnalyze: () => void
  onManualSeedApply?: (seed: string) => void
}

export default function ServerSeedReveal({
  serverSeedHash,
  clientSeed,
  analysisState,
  analysisResult,
  onAnalyze,
  onManualSeedApply
}: ServerSeedRevealProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [manualSeed, setManualSeed] = useState('')

  const canAnalyze = serverSeedHash.trim() && clientSeed.trim()
  const isDeterministic = analysisResult?.mode === 'DETERMINISTIC'
  const confidence = analysisResult?.confidence ?? 0

  const handleManualApply = () => {
    if (manualSeed.trim()) {
      onManualSeedApply?.(manualSeed.trim())
      toast.success('Manual seed applied — running deterministic analysis...')
    }
  }

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.90) return 'text-emerald-400'
    if (conf >= 0.50) return 'text-yellow-400'
    if (conf >= 0.25) return 'text-orange-400'
    return 'text-red-400'
  }

  const getBarColor = (conf: number) => {
    if (conf >= 0.90) return 'bg-emerald-500'
    if (conf >= 0.50) return 'bg-yellow-500'
    if (conf >= 0.25) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Brain size={24} />
          Backend Analysis Engine
        </h2>
        {analysisState === 'complete' && analysisResult && (
          <Badge
            variant={isDeterministic ? 'default' : 'secondary'}
            className={isDeterministic ? 'bg-emerald-600' : 'bg-amber-600'}
          >
            {isDeterministic ? (
              <span className="flex items-center gap-1">
                <ShieldCheck size={16} />
                DETERMINISTIC — {(confidence * 100).toFixed(1)}%
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Lightning size={16} />
                MULTI-MODE — {(confidence * 100).toFixed(1)}%
              </span>
            )}
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {/* Analysis trigger */}
        <div className="flex items-center gap-4">
          <Button
            onClick={onAnalyze}
            disabled={!canAnalyze || analysisState === 'analyzing'}
            className="bg-primary hover:bg-primary/90"
            size="lg"
          >
            {analysisState === 'analyzing' ? (
              <>
                <CircleNotch size={20} className="mr-2 animate-spin" />
                Running 5-Mode Analysis...
              </>
            ) : analysisState === 'complete' ? (
              <>
                <Brain size={20} className="mr-2" />
                Re-Analyze
              </>
            ) : (
              <>
                <Brain size={20} className="mr-2" />
                Analyze Game State
              </>
            )}
          </Button>
          {!canAnalyze && (
            <p className="text-xs text-muted-foreground">
              Provide Server Seed Hash and Client Seed in Configuration above
            </p>
          )}
        </div>

        {/* Results display */}
        {analysisState === 'complete' && analysisResult && (
          <div className="space-y-3">
            {isDeterministic && analysisResult.crackedSeed && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={20} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">
                    Server Seed Resolved — Deterministic Mode Active
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Resolved Server Seed</Label>
                  <p className="font-mono text-xs text-foreground break-all bg-secondary p-2 rounded">
                    {analysisResult.crackedSeed}
                  </p>
                </div>
              </div>
            )}

            {!isDeterministic && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <Lightning size={20} className="text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">
                    Fairness & Statistical Analysis
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Without a revealed server seed, exact mine positions CANNOT be predicted —
                  this is how provably fair systems work. The percentages below show the mathematical
                  base rates and fairness checks, NOT prediction accuracy. Provide a revealed seed
                  below for exact verification.
                </p>
              </div>
            )}

            {/* Per-mode confidence breakdown */}
            {!isDeterministic && analysisResult.modeResults && analysisResult.modeResults.length > 0 && (
              <div className="space-y-2 p-4 bg-secondary/40 rounded-md">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Analysis Mode Breakdown
                </h4>
                {analysisResult.modeResults.map((mode, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{mode.name}</span>
                      <span className={`text-xs font-bold ${getConfidenceColor(mode.confidence)}`}>
                        {(mode.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getBarColor(mode.confidence)}`}
                        style={{ width: `${mode.confidence * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{mode.description}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-secondary rounded-md text-center">
                <p className="text-xs text-muted-foreground">
                  {isDeterministic ? 'Verification Confidence' : 'Per-Tile Safety Rate'}
                </p>
                <p className={`text-lg font-bold ${getConfidenceColor(confidence)}`}>
                  {(confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-md text-center">
                <p className="text-xs text-muted-foreground">Mode</p>
                <p className="text-lg font-bold text-foreground">
                  {isDeterministic ? 'EXACT' : 'STATISTICAL'}
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-md text-center">
                <p className="text-xs text-muted-foreground">
                  {isDeterministic ? 'Kelly Allocation' : 'Suggested Allocation'}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {analysisResult.allocation?.toFixed(2) ?? '0.00'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Advanced: Manual seed entry */}
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? <CaretUp size={16} /> : <CaretDown size={16} />}
            Advanced: Manually provide revealed server seed
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-2">
              <Label htmlFor="manual-seed">Revealed Server Seed (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="manual-seed"
                  type="text"
                  value={manualSeed}
                  onChange={(e) => setManualSeed(e.target.value)}
                  placeholder="Paste revealed server seed for deterministic verification..."
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleManualApply}
                  variant="outline"
                  disabled={!manualSeed.trim()}
                >
                  Apply & Analyze
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                If you have the revealed server seed (post-game), enter it here for exact verification.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}