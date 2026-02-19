import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, ShieldSlash, Eye } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { sha256, verifyServerSeedHash } from '@/lib/crypto'

interface ServerSeedRevealProps {
  serverSeedHash: string
}

export default function ServerSeedReveal({ serverSeedHash }: ServerSeedRevealProps) {
  const [revealedSeed, setRevealedSeed] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [computedHash, setComputedHash] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleVerify = async () => {
    if (!revealedSeed.trim()) {
      toast.error('Please enter the revealed server seed')
      return
    }

    if (!serverSeedHash.trim()) {
      toast.error('Server seed hash is required for verification')
      return
    }

    setIsVerifying(true)
    
    try {
      const hash = await sha256(revealedSeed)
      setComputedHash(hash)
      
      const isValid = await verifyServerSeedHash(revealedSeed, serverSeedHash)
      setVerificationStatus(isValid ? 'valid' : 'invalid')
      
      if (isValid) {
        toast.success('Server seed verified successfully!')
      } else {
        toast.error('Hash verification failed - seed does not match')
      }
    } catch (error) {
      toast.error('Verification error occurred')
      setVerificationStatus('invalid')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleReset = () => {
    setRevealedSeed('')
    setVerificationStatus('idle')
    setComputedHash('')
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Eye size={24} />
          Server Seed Reveal
        </h2>
        {verificationStatus !== 'idle' && (
          <Badge 
            variant={verificationStatus === 'valid' ? 'default' : 'destructive'}
            className={verificationStatus === 'valid' ? 'bg-primary' : ''}
          >
            {verificationStatus === 'valid' ? (
              <span className="flex items-center gap-1">
                <ShieldCheck size={16} />
                Verified
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ShieldSlash size={16} />
                Invalid
              </span>
            )}
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="revealed-seed">Revealed Server Seed</Label>
          <Input
            id="revealed-seed"
            type="text"
            value={revealedSeed}
            onChange={(e) => {
              setRevealedSeed(e.target.value)
              setVerificationStatus('idle')
              setComputedHash('')
            }}
            placeholder="Enter the revealed server seed..."
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Enter the unhashed server seed to verify it matches the original hash
          </p>
        </div>

        {computedHash && (
          <div className="space-y-2">
            <Label>Computed Hash (SHA-256)</Label>
            <div className="p-3 bg-secondary rounded-md border border-border">
              <p className="font-mono text-xs break-all text-foreground">{computedHash}</p>
            </div>
          </div>
        )}

        {serverSeedHash && computedHash && (
          <div className="space-y-2">
            <Label>Expected Hash</Label>
            <div className="p-3 bg-secondary rounded-md border border-border">
              <p className="font-mono text-xs break-all text-foreground">{serverSeedHash}</p>
            </div>
          </div>
        )}

        {verificationStatus === 'valid' && (
          <div className="p-4 bg-primary/10 border border-primary rounded-md">
            <p className="text-sm text-primary font-medium flex items-center gap-2">
              <ShieldCheck size={20} />
              Hash verification successful! The revealed seed is authentic.
            </p>
          </div>
        )}

        {verificationStatus === 'invalid' && (
          <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
            <p className="text-sm text-destructive font-medium flex items-center gap-2">
              <ShieldSlash size={20} />
              Hash mismatch! The revealed seed does not produce the expected hash.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={handleVerify} 
            disabled={isVerifying || !revealedSeed.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            <ShieldCheck size={20} className="mr-2" />
            {isVerifying ? 'Verifying...' : 'Verify Hash'}
          </Button>
          
          {verificationStatus !== 'idle' && (
            <Button 
              onClick={handleReset}
              variant="outline"
            >
              Reset
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
