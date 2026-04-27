import { Card } from '@/components/ui/card'
import { DiceThree } from '@phosphor-icons/react'

export default function DiceGame() {
  return (
    <Card className="p-8 border-slate-800 bg-slate-900/50 backdrop-blur">
      <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
        <DiceThree size={48} className="mb-4 text-emerald-500/50" />
        <h3 className="text-xl font-bold text-slate-200 mb-2">Dice Optimizer</h3>
        <p className="max-w-md text-slate-400">
          Target multiplier optimization and roll sequence statistical tracking is under construction.
        </p>
      </div>
    </Card>
  )
}
