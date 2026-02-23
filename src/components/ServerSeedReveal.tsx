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
                PROBABILISTIC — {(confidence * 100).toFixed(1)}%
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
                Resolving Hash & Analyzing...
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
                    Hash Not Resolved — Monte Carlo Probabilistic Mode
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  The backend could not reverse the server seed hash. Game boards show probability-based
                  analysis using 50,000 Monte Carlo simulations. Provide a revealed server seed below for exact results.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-secondary rounded-md text-center">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-lg font-bold text-foreground">
                  {(confidence * 100).toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-md text-center">
                <p className="text-xs text-muted-foreground">Mode</p>
                <p className="text-lg font-bold text-foreground">
                  {isDeterministic ? 'EXACT' : 'PROB'}
                </p>
              </div>
              <div className="p-3 bg-secondary rounded-md text-center">
                <p className="text-xs text-muted-foreground">Allocation</p>
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