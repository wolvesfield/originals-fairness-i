import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getSeedHistory, clearSeedHistory, type SeedHistoryEntry } from '@/db/browserDb'

interface SeedHistoryProps {
  onApplyEntry: (serverSeedHash: string, clientSeed: string, nonce: number, revealedSeed?: string) => void
  refreshTrigger?: number // increment to force refresh
}

export default function SeedHistory({ onApplyEntry, refreshTrigger }: SeedHistoryProps) {
  const [history, setHistory] = useState<SeedHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const entries = await getSeedHistory(50)
      setHistory(entries)
    } catch (err) {
      console.error('Failed to load seed history:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [refreshTrigger])

  const handleClear = async () => {
    await clearSeedHistory()
    setHistory([])
  }

  if (history.length === 0 && !isLoading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-2">📋 Seed & Hash History</h2>
        <p className="text-sm text-muted-foreground">
          No analysis history yet. Run an analysis to start recording seed data.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">📋 Seed & Hash History</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadHistory} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-400 hover:text-red-300">
            Clear All
          </Button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2">
        {history.map((entry, idx) => (
          <div
            key={entry.id ?? idx}
            className="p-3 bg-secondary/40 rounded-md border border-border/50 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={entry.mode === 'DETERMINISTIC' ? 'default' : 'secondary'}
                  className={entry.mode === 'DETERMINISTIC' ? 'bg-emerald-600 text-xs' : 'bg-amber-600 text-xs'}
                >
                  {entry.mode}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {entry.gameType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {(entry.confidence * 100).toFixed(1)}% confidence
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => onApplyEntry(
                  entry.serverSeedHash,
                  entry.clientSeed,
                  entry.nonce,
                  entry.revealedServerSeed
                )}
              >
                Re-use
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs font-mono">
              <div>
                <span className="text-muted-foreground">Server Hash: </span>
                <span className="break-all">{entry.serverSeedHash.slice(0, 24)}...</span>
              </div>
              <div>
                <span className="text-muted-foreground">Client Seed: </span>
                <span>{entry.clientSeed}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Nonce: </span>
                <span>{entry.nonce}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Platform: </span>
                <span>{entry.platform}</span>
              </div>
              {entry.revealedServerSeed && (
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Revealed Seed: </span>
                  <span className="break-all text-emerald-400">{entry.revealedServerSeed.slice(0, 32)}...</span>
                </div>
              )}
            </div>

            <div className="text-[10px] text-muted-foreground mt-1">
              {new Date(entry.timestamp).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
