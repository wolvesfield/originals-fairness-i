import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface ConfigPanelProps {
  serverSeedHash: string
  setServerSeedHash: (value: string) => void
  clientSeed: string
  setClientSeed: (value: string) => void
  nonce: number
  setNonce: (value: number) => void
  mineCount: number
  setMineCount: (value: number) => void
  revealedServerSeed?: string | null
  setRevealedServerSeed?: (value: string | null) => void
}

export default function ConfigPanel({
  serverSeedHash,
  setServerSeedHash,
  clientSeed,
  setClientSeed,
  nonce,
  setNonce,
  mineCount,
  setMineCount,
  revealedServerSeed,
  setRevealedServerSeed
}: ConfigPanelProps) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-4">Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="server-seed-hash">Server Seed Hash</Label>
          <Input
            id="server-seed-hash"
            type="text"
            value={serverSeedHash}
            onChange={(e) => setServerSeedHash(e.target.value)}
            placeholder="e.g. 7844d07c94a99c29e71a028434a24b87..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">SHA-256 hash from your active game session</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="revealed-server-seed">Revealed Server Seed (required for Verify Keno / Crash / Mines / Batch)</Label>
          <Input
            id="revealed-server-seed"
            type="text"
            value={revealedServerSeed ?? ''}
            onChange={(e) => setRevealedServerSeed?.(e.target.value.trim() || null)}
            placeholder="Paste here after a round settles, or from Stake bet history (Apply a bet)"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Stake reveals this only after a round. Paste it here, or use Stake tab → Load bet history → Apply a bet that has the seed.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="client-seed">Client Seed</Label>
          <Input
            id="client-seed"
            type="text"
            value={clientSeed}
            onChange={(e) => setClientSeed(e.target.value)}
            placeholder="e.g. lRB-is3c4H"
            className="font-mono text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="nonce">Nonce</Label>
          <Input
            id="nonce"
            type="number"
            value={nonce}
            onChange={(e) => setNonce(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="font-mono text-sm"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="mine-count">Mine Count</Label>
          <Input
            id="mine-count"
            type="number"
            value={mineCount}
            onChange={(e) => setMineCount(parseInt(e.target.value) || 3)}
            placeholder="3"
            min={1}
            max={24}
            className="font-mono text-sm"
          />
        </div>
      </div>
    </Card>
  )
}