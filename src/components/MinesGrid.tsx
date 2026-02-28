import React from 'react';

interface Props {
  heatMap: number[];
  isCracked: boolean;
  safeTiles?: number[];
  gridSize?: number; // 5 for Stake (25 tiles), 8 for Roobet (64 tiles)
  mineTiles?: number[]; // actual mine positions when known
  mineCount?: number; // number of mines for base rate calculation
}

export const MinesGrid: React.FC<Props> = React.memo(({
  heatMap, 
  isCracked, 
  safeTiles = [], 
  gridSize = 5,
  mineTiles = [],
  mineCount = 3
}) => {
  const totalCells = gridSize * gridSize;
  const tileSize = gridSize <= 5 ? 'h-14 w-14' : 'h-10 w-10';
  const fontSize = gridSize <= 5 ? 'text-[10px]' : 'text-[8px]';
  const probFontSize = gridSize <= 5 ? 'text-xs' : 'text-[9px]';
  
  // Base rate: expected mine probability for a fair game
  const baseRate = mineCount / totalCells; // e.g. 3/25 = 0.12

  return (
    <div 
      className="grid gap-1" 
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: totalCells }, (_, i) => {
        const prob = heatMap[i] ?? baseRate;
        const isSafe = safeTiles.includes(i);
        const isMine = mineTiles.includes(i);
        
        let displayText: string;
        let bg: string;
        let textColor: string;
        let glow = '';

        if (isCracked || mineTiles.length > 0) {
          // Deterministic mode — we know exact positions
          if (isMine) {
            displayText = '💣';
            bg = 'bg-red-700/80';
            textColor = 'text-red-200';
          } else {
            displayText = '💎';
            bg = 'bg-emerald-600/80';
            textColor = 'text-emerald-100';
            if (isSafe) {
              glow = 'shadow-[0_0_12px_rgba(16,185,129,0.6)] ring-2 ring-emerald-400';
            }
          }
        } else {
          // Probabilistic mode — color based on DEVIATION from base rate
          const deviation = prob - baseRate; // positive = more mines than avg, negative = fewer
          const deviationPercent = baseRate > 0 ? (deviation / baseRate) * 100 : 0;
          const minePercent = (prob * 100).toFixed(1);
          
          displayText = `${minePercent}%`;

          if (deviationPercent > 10) {
            // Significantly MORE mines than average → RED (danger)
            bg = 'bg-red-800/50';
            textColor = 'text-red-300';
            displayText = `⛏️${minePercent}%`;
          } else if (deviationPercent > 3) {
            // Slightly above average → ORANGE  
            bg = 'bg-orange-700/40';
            textColor = 'text-orange-200';
          } else if (deviationPercent > -3) {
            // Near average → YELLOW (50/50 relative to expectation)
            bg = 'bg-yellow-700/40';
            textColor = 'text-yellow-200';
          } else if (deviationPercent > -10) {
            // Slightly below average → LIGHT GREEN
            bg = 'bg-emerald-700/40';
            textColor = 'text-emerald-200';
          } else {
            // Significantly FEWER mines than average → GREEN (safer)
            bg = 'bg-emerald-600/60';
            textColor = 'text-emerald-100';
            glow = 'shadow-[0_0_8px_rgba(16,185,129,0.3)]';
            displayText = `💎${minePercent}%`;
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
});