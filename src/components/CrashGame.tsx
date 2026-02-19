import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface CrashGameProps {
  serverSeedHash: string
  clientSeed: string
  nonce: number
  onVerify: () => void
}

export default function CrashGame({
  serverSeedHash,
  clientSeed,
  nonce,
  onVerify
}: CrashGameProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [multiplier, setMultiplier] = useState(1.0)
  const [crashed, setCrashed] = useState(false)
  const [crashPoint, setCrashPoint] = useState(0)
  const animationRef = useRef<number | undefined>()
  const startTimeRef = useRef<number | undefined>()
  const pathRef = useRef<SVGPathElement>(null)

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  const calculateCrashPoint = () => {
    let seed = `${serverSeedHash}${clientSeed}${nonce}`
    let hash = 0
    
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i)
      hash = hash & hash
    }
    
    const normalized = Math.abs(hash) / 2147483647
    const crash = Math.max(1.01, Math.min(100, 1 + normalized * 10))
    
    return parseFloat(crash.toFixed(2))
  }

  const animate = (timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp
    }

    const elapsed = timestamp - startTimeRef.current
    const seconds = elapsed / 1000
    
    const currentMultiplier = 1 + Math.pow(1.1, seconds) - 1
    
    setMultiplier(currentMultiplier)

    if (currentMultiplier >= crashPoint) {
      setCrashed(true)
      setMultiplier(crashPoint)
      setIsAnimating(false)
      toast.error(`Crashed at ${crashPoint.toFixed(2)}x!`)
      return
    }

    drawPath(currentMultiplier)
    animationRef.current = requestAnimationFrame(animate)
  }

  const drawPath = (currentMult: number) => {
    if (!pathRef.current) return

    const width = 800
    const height = 500
    const padding = 40

    let pathData = `M ${padding} ${height - padding}`

    const steps = 100
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps
      const x = padding + (width - 2 * padding) * progress
      
      const mult = 1 + (currentMult - 1) * progress
      const normalizedY = (mult - 1) / (currentMult - 1)
      const y = height - padding - normalizedY * (height - 2 * padding)
      
      pathData += ` L ${x} ${y}`
    }

    pathRef.current.setAttribute('d', pathData)
  }

  const handleVerify = () => {
    if (!serverSeedHash || !clientSeed) {
      toast.error('Please fill in Server Seed Hash and Client Seed')
      return
    }

    if (isAnimating) return

    const crash = calculateCrashPoint()
    setCrashPoint(crash)
    setMultiplier(1.0)
    setCrashed(false)
    setIsAnimating(true)
    startTimeRef.current = undefined
    
    if (pathRef.current) {
      pathRef.current.setAttribute('d', 'M 40 460')
    }

    onVerify()
    toast.success(`Starting crash simulation... Target: ${crash.toFixed(2)}x`)
    
    animationRef.current = requestAnimationFrame(animate)
  }

  return (
    <div className="space-y-6">
      <div>
        <Button 
          onClick={handleVerify} 
          className="bg-primary hover:bg-primary/90"
          disabled={isAnimating}
        >
          <Check size={20} className="mr-2" />
          {isAnimating ? 'Running...' : 'Verify Crash'}
        </Button>
      </div>

      <div className="relative flex justify-center items-center bg-secondary/50 rounded-lg p-6">
        <svg
          width="800"
          height="500"
          viewBox="0 0 800 500"
          className="max-w-full h-auto"
        >
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={crashed ? '#ef4444' : '#10b981'} stopOpacity="0.3" />
              <stop offset="100%" stopColor={crashed ? '#ef4444' : '#10b981'} stopOpacity="0.9" />
            </linearGradient>
          </defs>

          <line x1="40" y1="460" x2="760" y2="460" stroke="#334155" strokeWidth="2" />
          <line x1="40" y1="40" x2="40" y2="460" stroke="#334155" strokeWidth="2" />

          <text x="400" y="490" textAnchor="middle" fill="#64748b" fontSize="14" fontFamily="JetBrains Mono">
            Time
          </text>
          <text x="15" y="250" textAnchor="middle" fill="#64748b" fontSize="14" fontFamily="JetBrains Mono" transform="rotate(-90 15 250)">
            Multiplier
          </text>

          <path
            ref={pathRef}
            d="M 40 460"
            fill="none"
            stroke={crashed ? '#ef4444' : '#10b981'}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: crashed ? 'drop-shadow(0 0 10px #ef4444)' : 'drop-shadow(0 0 10px #10b981)'
            }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`font-mono font-bold text-8xl transition-colors duration-300 ${
              crashed ? 'text-red-500' : 'text-emerald-400'
            }`}
            style={{
              textShadow: crashed
                ? '0 0 40px rgba(239, 68, 68, 0.8)'
                : '0 0 40px rgba(16, 185, 129, 0.8)'
            }}
          >
            {multiplier.toFixed(2)}x
          </div>
        </div>
      </div>

      {crashed && (
        <div className="text-center">
          <p className="text-lg font-semibold text-red-500">
            💥 Crashed at {crashPoint.toFixed(2)}x
          </p>
        </div>
      )}
    </div>
  )
}
