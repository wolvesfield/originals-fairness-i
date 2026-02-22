import React from 'react';

interface ScannerResult {
  found: boolean;
  nonce?: number;
  safePath?: number[];
}

interface Props {
  scannerResult: ScannerResult;
  confidence: number;
  hashStatus: 'CRACKED' | 'SEARCHING' | 'UNKNOWN';
}

export const GoldPathHUD: React.FC<Props> = ({ scannerResult, confidence, hashStatus }) => {
  if (!scannerResult.found) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <h2 className="text-4xl font-black text-yellow-400 animate-pulse">
        🚨 GOLD PATH DETECTED: NONCE #{scannerResult.nonce}
      </h2>
      <p className="mt-2 text-2xl text-emerald-400">
        CONFIDENCE: {(confidence * 100).toFixed(2)}%
      </p>
      <p className="mt-1 text-sm text-gray-400 uppercase">
        Mode: {hashStatus === 'CRACKED' ? 'DETERMINISTIC' : 'PROBABILISTIC'}
      </p>
      <div className="grid grid-cols-5 gap-1 mt-6">
        {Array.from({ length: 25 }, (_, i) => (
          <div
            key={i}
            className={`h-10 w-10 flex items-center justify-center rounded text-xs font-bold ${
              scannerResult.safePath?.includes(i)
                ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)] text-white'
                : 'bg-gray-800 text-gray-500'
            }`}
          >
            {i}
          </div>
        ))}
      </div>
    </div>
  );
};
