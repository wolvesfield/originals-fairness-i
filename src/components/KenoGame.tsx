import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface KenoGameProps {
  serverSeedHash: string
  clientSeed: string
  nonce: number
  onVerify: () => void
}

export default function KenoGame({
  serverSeedHash,
  clientSeed,
  nonce,
  onVerify
}: KenoGameProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [isVerified, setIsVerified] = useState(false)

  const handleVerify = () => {
    if (!serverSeedHash || !clientSeed) {
      toast.error('Please fill in Server Seed Hash and Client Seed')
      return
    }

    const numbers: number[] = []
    let seed = `${serverSeedHash}${clientSeed}${nonce}`
    
    for (let i = 0; i < 10; i++) {
      let hash = 0
      for (let j = 0; j < seed.length; j++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(j)
        hash = hash & hash
      }
      
      const position = (Math.abs(hash) % 40) + 1
      
      if (!numbers.includes(position)) {
        numbers.push(position)
      } else {
        i--
      }
      
      seed = seed + i
    }

    setSelectedNumbers(numbers.sort((a, b) => a - b))
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
