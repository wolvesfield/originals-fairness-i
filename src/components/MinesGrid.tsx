import React from 'react';

interface Props {
  heatMap: number[];
  isCracked: boolean;
  safeTiles?: number[];
}

export const MinesGrid: React.FC<Props> = ({ heatMap, isCracked, safeTiles = [] }) => {
  return (
    <div className="grid grid-cols-5 gap-2">
      {heatMap.map((prob, i) => {
        const isSafe = safeTiles.includes(i);
        const displayProb = isCracked
          ? isSafe ? '100%' : '0%'
          : `${((1 - prob) * 100).toFixed(1)}%`;
        const glow = (isCracked && isSafe) || (!isCracked && prob < 0.15)
          ? 'shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse'
          : '';
        const bg = isCracked && isSafe ? 'bg-emerald-600' : 'bg-slate-800';

        return (
          <div key={i} className={`${bg} ${glow} h-14 w-14 flex flex-col items-center justify-center rounded`}>
            <span className="text-[10px] text-gray-300">{i}</span>
            <span className={`text-xs font-bold ${prob < 0.15 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {displayProb}
            </span>
          </div>
        );
      })}
    </div>
  );
};
