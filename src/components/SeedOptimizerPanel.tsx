import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RocketLaunch, ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ClientSeedOptimizer } from '@/analysis/ClientSeedOptimizer'

interface SeedOptimizerPanelProps {
    unhashedServerSeed: string | null
    serverSeedHash: string
    nonce: number
    targetTiles: number[]
    mineCount: number
    totalCells: number
    onApplySeed: (seed: string) => void
}

export default function SeedOptimizerPanel({
    unhashedServerSeed,
    serverSeedHash,
    nonce,
    targetTiles,
    mineCount,
    totalCells,
    onApplySeed
}: SeedOptimizerPanelProps) {
    const [isOptimizing, setIsOptimizing] = useState(false)
    const [bestSeed, setBestSeed] = useState<string | null>(null)
    const [safeProbability, setSafeProbability] = useState<number | null>(null)
    const [iterations, setIterations] = useState<number>(0)

    const handleOptimize = () => {
        if (!serverSeedHash) {
            toast.error('Server Seed Hash is required to run statistical optimization.')
            return
        }

        if (targetTiles.length === 0) {
            toast.error('Select target tiles in the Mines grid first to optimize for them.')
            return
        }

        setIsOptimizing(true)

        // Give UI time to paint 'Optimizing...'
        setTimeout(() => {
            const optimizer = new ClientSeedOptimizer()
            const result = optimizer.optimizeForTargetMines(
                unhashedServerSeed,
                serverSeedHash,
                nonce,
                targetTiles,
                mineCount,
                totalCells,
                2500 // Search aggressively for 2.5 seconds block time
            )

            setBestSeed(result.bestSeed)
            setSafeProbability(result.safeProbability)
            setIterations(result.iterations)
            setIsOptimizing(false)

            if (result.safeProbability > 0.95) {
                toast.success(`Found extreme advantage seed in ${result.timeMs}ms!`)
            } else {
                toast.success(`Analysis complete. Tested ${result.iterations.toLocaleString()} seeds.`)
            }
        }, 50)
    }

    const handleApply = () => {
        if (bestSeed) {
            onApplySeed(bestSeed)
            toast.success('Golden Client Seed applied to configuration.')
        }
    }

    return (
        <Card className="p-6 border-emerald-500/30 bg-emerald-950/10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-emerald-400">
                        <RocketLaunch size={24} />
                        Client Seed Optimizer (Probability Skewing)
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Locally brute-forces thousands of rng client seeds to find the mathematically optimal
                        seed that bends the Monte Carlo spread away from your exact active target tiles.
                        <strong>Change your seed to this on the platform before the next bet to maximize edge.</strong>
                    </p>
                </div>
                <Button
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                >
                    {isOptimizing ? 'Brute-forcing...' : 'Find Golden Seed'}
                </Button>
            </div>

            {bestSeed && safeProbability !== null && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Golden Client Seed</p>
                        <div className="flex items-center justify-between">
                            <p className="text-lg font-mono font-bold text-white">{bestSeed}</p>
                            <Button size="sm" variant="secondary" onClick={handleApply}>Apply</Button>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Target Safety Odds</p>
                        <p className={`text-xl font-mono font-bold ${safeProbability >= 0.9 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {(safeProbability * 100).toFixed(1)}%
                            {unhashedServerSeed && ' (Deterministic 100%)'}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tested Permutations</p>
                        <p className="text-xl font-mono font-bold text-blue-400">
                            {iterations.toLocaleString()} seeds
                        </p>
                    </div>
                </div>
            )}
        </Card>
    )
}
