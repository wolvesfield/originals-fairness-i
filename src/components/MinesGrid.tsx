import React from 'react';

interface Props {
  heatMap: number[];
  isCracked: boolean;
  safeTiles?: number[];
  gridSize?: number; // 5 for Stake (25 tiles), 8 for Roobet (64 tiles)
  mineTiles?: number[]; // actual mine positions when known
}

export const MinesGrid: React.FC<Props> = ({ 
  heatMap, 
  isCracked, 
  safeTiles = [], 
  gridSize = 5,
  mineTiles = []
}) => {
  const totalCells = gridSize * gridSize;
  const tileSize = gridSize <= 5 ? 'h-14 w-14' : 'h-10 w-10';
  const fontSize = gridSize <= 5 ? 'text-[10px]' : 'text-[8px]';
  const probFontSize = gridSize <= 5 ? 'text-xs' : 'text-[9px]';

  return (
    <div 
      className="grid gap-1" 
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: totalCells }, (_, i) => {
        const prob = heatMap[i] ?? 0.5;
        const isSafe = safeTiles.includes(i);
        const isMine = mineTiles.includes(i);
        
        // Determine safety percentage
        let safePercent: number;
        let displayText: string;
        
        if (isCracked || mineTiles.length > 0) {
          // Deterministic mode — we know exact positions
          safePercent = isMine ? 0 : 100;
          displayText = isMine ? '💣' : '💎';
        } else {
          // Probabilistic mode — show probability
          safePercent = (1 - prob) * 100;
          displayText = `${safePercent.toFixed(1)}%`;
        }

        // Color coding based on safety
        let bg: string;
        let textColor: string;
        let glow = '';

        if (isCracked || mineTiles.length > 0) {
          // Known positions: green for diamonds, red for bombs
          if (isMine) {
            bg = 'bg-red-700/80';
            textColor = 'text-red-200';
          } else {
            bg = 'bg-emerald-600/80';
            textColor = 'text-emerald-100';
            if (isSafe) {
              glow = 'shadow-[0_0_12px_rgba(16,185,129,0.6)] ring-2 ring-emerald-400';
            }
          }
        } else {
          // Probabilistic: gradient from green (safe) through yellow to red (dangerous)
          if (safePercent >= 90) {
            bg = 'bg-emerald-600/70';
            textColor = 'text-emerald-100';
            glow = 'shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse';
          } else if (safePercent >= 75) {
            bg = 'bg-emerald-700/50';
            textColor = 'text-emerald-200';
          } else if (safePercent >= 60) {
            bg = 'bg-yellow-700/40';
            textColor = 'text-yellow-200';
          } else if (safePercent >= 40) {
            bg = 'bg-orange-700/40';
            textColor = 'text-orange-200';
          } else {
            bg = 'bg-red-800/40';
            textColor = 'text-red-300';
          }
        }

        return (
          <div 
            key={i} 
            className={`${bg} ${glow} ${tileSize} flex flex-col items-center justify-center rounded border border-slate-700/50 transition-all duration-300`}
          >
            <span className={`${fontSize} text-gray-400`}>{i}</span>
            <span className={`${probFontSize} font-bold ${textColor}`}>
              {displayText}
            </span>
          </div>
        );
      })}
    </div>
  );
};