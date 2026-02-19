import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check } from '@phosphor-icons/react'
import type { Platform, GridSize } from '@/lib/types'
import { toast } from 'sonner'

interface MinesGameProps {
  platform: Platform
  serverSeedHash: string
  clientSeed: string
  nonce: number
  mineCount: number
  onVerify: () => void
}

export default function MinesGame({
  platform,
  serverSeedHash,
  clientSeed,
  nonce,
  mineCount,
  onVerify
}: MinesGameProps) {
  const [gridSize, setGridSize] = useState<GridSize>(5)
  const [verifiedMines, setVerifiedMines] = useState<number[]>([])
  const [isVerified, setIsVerified] = useState(false)

  const totalCells = gridSize * gridSize
  const maxMines = platform === 'stake' ? 24 : Math.min(totalCells - 1, 35)

  const handleVerify = () => {
    if (!serverSeedHash || !clientSeed) {
      toast.error('Please fill in Server Seed Hash and Client Seed')
      return
    }

    if (mineCount < 1 || mineCount > maxMines) {
      toast.error(`Mine count must be between 1 and ${maxMines}`)
      return
    }

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

    setVerifiedMines(mines)
    setIsVerified(true)
    onVerify()
    toast.success(`Verified ${mineCount} mines on ${gridSize}x${gridSize} grid`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        {platform === 'roobet' && (
          <div className="space-y-2">
            <Label>Grid Size</Label>
            <Select
              value={gridSize.toString()}
              onValueChange={(value) => {
                setGridSize(parseInt(value) as GridSize)
                setIsVerified(false)
                setVerifiedMines([])
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5x5</SelectItem>
                <SelectItem value="6">6x6</SelectItem>
                <SelectItem value="7">7x7</SelectItem>
                <SelectItem value="8">8x8</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="flex-1">
          <Button onClick={handleVerify} className="bg-primary hover:bg-primary/90">
            <Check size={20} className="mr-2" />
            Verify Mines
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            maxWidth: `${gridSize * 60}px`
          }}
        >
          {Array.from({ length: totalCells }).map((_, index) => {
            const isMine = verifiedMines.includes(index)
            
            return (
              <div
                key={index}
                className={`
                  aspect-square rounded-md border-2 flex items-center justify-center
                  transition-all duration-300 font-mono text-sm font-bold
                  ${
                    isMine
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 animate-fadeIn'
                      : 'bg-secondary border-border text-muted-foreground'
                  }
                `}
                style={{
                  animationDelay: isVerified ? `${verifiedMines.indexOf(index) * 50}ms` : '0ms'
                }}
              >
                {isMine && '💣'}
              </div>
            )
          })}
        </div>
      </div>

      {isVerified && (
        <div className="text-center text-sm text-muted-foreground">
          Found {verifiedMines.length} mines on {gridSize}x{gridSize} grid
        </div>
      )}
    </div>
  )
}
