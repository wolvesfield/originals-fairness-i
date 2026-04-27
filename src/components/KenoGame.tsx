import { Card } from '@/components/ui/card'
import { Target } from '@phosphor-icons/react'

export default function KenoGame() {
  return (
    <Card className="p-8 border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <Target size={48} className="mb-4 text-emerald-500/50" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">Keno Engine</h3>
        <p className="max-w-md text-slate-400">
          Advanced Keno tracking and statistical prediction engine is under construction.
          This will integrate with the ClosestToWinEV mathematical bridge.
        </p>
      </div>
    </Card>
  )
}
