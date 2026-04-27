import { Card } from '@/components/ui/card'
import { Bird } from '@phosphor-icons/react'

export default function ChickenGame() {
  return (
    <Card className="p-8 border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <Bird size={48} className="mb-4 text-emerald-500/50" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">Chicken Analysis</h3>
        <p className="max-w-md text-slate-400">
          Bone layout predictability and safe-zone clustering is under construction.
        </p>
      </div>
    </Card>
  )
}
