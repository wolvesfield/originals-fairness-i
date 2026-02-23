import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  addGameResult,
  getGameResults,
  getGameResultStats,
  clearGameResults,
  type GameResultEntry
} from '@/db/browserDb'

interface GameResultRecorderProps {
  platform: string
  serverSeedHash: string
  clientSeed: string
  nonce: number
  mineCount: number
  refreshTrigger?: number
}

export default function GameResultRecorder({
  platform,
  serverSeedHash,
  clientSeed,
  nonce,
  mineCount,
  refreshTrigger
}: GameResultRecorderProps) {
  const [gameType, setGameType] = useState<'mines' | 'keno' | 'crash'>('mines')
  const [won, setWon] = useState<boolean | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [payout, setPayout] = useState('')
  const [minesFound, setMinesFound] = useState('')
  const [notes, setNotes] = useState('')
  const [results, setResults] = useState<GameResultEntry[]>([])
  const [stats, setStats] = useState<{
    totalGames: number; wins: number; losses: number; winRate: number;
    totalBet: number; totalPayout: number; netPnL: number;
  } | null>(null)
  const [showForm, setShowForm] = useState(true)

  const loadResults = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([getGameResults(50), getGameResultStats()])
      setResults(r)
      setStats(s)
    } catch (err) {
      console.warn('Failed to load game results:', err)
    }
  }, [])

  useEffect(() => { loadResults() }, [loadResults, refreshTrigger])

  const handleSubmit = async () => {
    if (won === null) {
      toast.error('Select Won or Lost')
      return
    }
    if (!betAmount || parseFloat(betAmount) <= 0) {
      toast.error('Enter a valid bet amount')
      return
    }

    try {
      await addGameResult({
        platform,
        gameType,
        mineCount: gameType === 'mines' ? mineCount : undefined,
        totalCells: gameType === 'mines' ? 25 : undefined,
        minesFound: minesFound.trim() || undefined,
        won,
        betAmount: parseFloat(betAmount),
        payout: parseFloat(payout || '0'),
        serverSeedHash: serverSeedHash || undefined,
        clientSeed: clientSeed || undefined,
        nonce: nonce || undefined,
        notes: notes.trim() || undefined,
        timestamp: new Date().toISOString()
      })

      toast.success(`Game result recorded: ${won ? 'WIN' : 'LOSS'}`)

      // Reset form
      setWon(null)
      setBetAmount('')
      setPayout('')
      setMinesFound('')
      setNotes('')

      await loadResults()
    } catch (err) {
      toast.error('Failed to save game result')
      console.error(err)
    }
  }

  const handleClear = async () => {
    if (!confirm('Clear all game results? This cannot be undone.')) return
    await clearGameResults()
    await loadResults()
    toast.success('Game results cleared')
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Game Result Recorder</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Hide Form' : 'Record Game'}
          </Button>
          {results.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-400">
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && stats.totalGames > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-secondary rounded-md text-center">
            <p className="text-xs text-muted-foreground">Total Games</p>
            <p className="text-lg font-bold">{stats.totalGames}</p>
          </div>
          <div className="p-3 bg-secondary rounded-md text-center">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className={`text-lg font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stats.winRate.toFixed(1)}%
            </p>
          </div>
          <div className="p-3 bg-secondary rounded-md text-center">
            <p className="text-xs text-muted-foreground">W / L</p>
            <p className="text-lg font-bold">
              <span className="text-emerald-400">{stats.wins}</span>
              {' / '}
              <span className="text-red-400">{stats.losses}</span>
            </p>
          </div>
          <div className="p-3 bg-secondary rounded-md text-center">
            <p className="text-xs text-muted-foreground">Net P&L</p>
            <p className={`text-lg font-bold ${stats.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {stats.netPnL >= 0 ? '+' : ''}{stats.netPnL.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Input Form */}
      {showForm && (
        <div className="space-y-3 mb-4 p-4 bg-secondary/40 rounded-md">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Game Type</Label>
              <Select value={gameType} onValueChange={(v) => setGameType(v as 'mines' | 'keno' | 'crash')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mines">Mines</SelectItem>
                  <SelectItem value="keno">Keno</SelectItem>
                  <SelectItem value="crash">Crash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Result</Label>
              <div className="flex gap-2">
                <Button
                  variant={won === true ? 'default' : 'outline'}
                  size="sm"
                  className={won === true ? 'bg-emerald-600 hover:bg-emerald-700 flex-1' : 'flex-1'}
                  onClick={() => setWon(true)}
                >
                  Won
                </Button>
                <Button
                  variant={won === false ? 'default' : 'outline'}
                  size="sm"
                  className={won === false ? 'bg-red-600 hover:bg-red-700 flex-1' : 'flex-1'}
                  onClick={() => setWon(false)}
                >
                  Lost
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Bet Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Payout (0 if lost)</Label>
              <Input
                type="number"
                step="0.01"
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {gameType === 'mines' && (
            <div className="space-y-1">
              <Label className="text-xs">Mine Positions Found (comma-separated, e.g. 3,7,15)</Label>
              <Input
                value={minesFound}
                onChange={(e) => setMinesFound(e.target.value)}
                placeholder="3, 7, 15"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations..."
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Auto-filled: Platform={platform}, Nonce={nonce}, Mines={mineCount}</span>
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Save Game Result
          </Button>
        </div>
      )}

      {/* Recent Results */}
      {results.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Recent Results
          </h4>
          {results.slice(0, 20).map((r, idx) => (
            <div
              key={r.id ?? idx}
              className="flex items-center justify-between p-2 rounded text-xs bg-secondary/30"
            >
              <div className="flex items-center gap-2">
                <Badge variant={r.won ? 'default' : 'destructive'} className={r.won ? 'bg-emerald-600' : ''}>
                  {r.won ? 'W' : 'L'}
                </Badge>
                <span className="text-muted-foreground">{r.gameType.toUpperCase()}</span>
                {r.nonce !== undefined && <span className="font-mono">#{r.nonce}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">Bet: {r.betAmount.toFixed(2)}</span>
                <span className={r.payout > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {r.payout > 0 ? `+${r.payout.toFixed(2)}` : '0.00'}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {new Date(r.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No game results recorded yet. Click "Record Game" to start tracking.
        </p>
      )}
    </Card>
  )
}
