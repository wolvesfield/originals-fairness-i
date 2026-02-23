import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { generateKenoNumbers } from '@/utils/fairnessEngine'
import type { GameRoundResult } from '@/controllers/MasterController'

interface KenoGameProps {
  serverSeedHash: string
  revealedServerSeed?: string | null
  clientSeed: string
  nonce: number
  onVerify: () => void
  analysisResult?: GameRoundResult | null
}

export default function KenoGame({
  serverSeedHash,
  revealedServerSeed,
  clientSeed,
  nonce,
  onVerify,
  analysisResult
}: KenoGameProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [isVerified, setIsVerified] = useState(false)

  // Auto-populate from backend analysis results
  useEffect(() => {
    if (!analysisResult) return

    if (analysisResult.kenoScanResults?.length) {
      const currentResult = analysisResult.kenoScanResults.find(r => r.nonce === nonce)
      if (currentResult) {
        setSelectedNumbers(currentResult.drawnNumbers)
        setIsVerified(true)
      }
    }
  }, [analysisResult, nonce])

  const handleVerify = () => {
    if (!clientSeed) {
      toast.error('Please fill in Client Seed')
      return
    }

    // Use revealed server seed (from analysis or manual entry), NOT the hash
    const seed = revealedServerSeed
    if (!seed) {
      toast.error('Server seed required — run "Analyze Game State" or provide the revealed seed')
      return
    }

    const numbers = generateKenoNumbers(seed, clientSeed, nonce, 10, 40)

    setSelectedNumbers(numbers)
    setIsVerified(true)
    onVerify()
    toast.success(`Selected 10 numbers: ${numbers.join(', ')}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <Button onClick={handleVerify} className="bg-primary hover:bg-primary/90">
          <Check size={20} className="mr-2" />
          Verify Keno
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="grid grid-cols-8 gap-2 max-w-3xl">
          {Array.from({ length: 40 }).map((_, index) => {
            const number = index + 1
            const isSelected = selectedNumbers.includes(number)
            
            return (
              <div
                key={number}
                className={`
                  aspect-square rounded-md border-2 flex items-center justify-center
                  transition-all duration-300 font-mono text-lg font-bold
                  ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/50 animate-fadeIn'
                      : 'bg-secondary border-border text-muted-foreground'
                  }
                `}
                style={{
                  animationDelay: isVerified ? `${selectedNumbers.indexOf(number) * 50}ms` : '0ms'
                }}
              >
                {number}
              </div>
            )
          })}
        </div>
      </div>

      {isVerified && (
        <div className="text-center text-sm text-muted-foreground">
          Selected Numbers: {selectedNumbers.join(', ')}
        </div>
      )}
    </div>
  )
}
