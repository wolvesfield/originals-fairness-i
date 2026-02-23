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
  onClose?: () => void;
}

export const GoldPathHUD: React.FC<Props> = ({ scannerResult, confidence, hashStatus, onClose }) => {
  if (!scannerResult.found) return null;

  const gridSize = 5; // TODO: make dynamic based on platform

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* Close / Back button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xl transition-colors border border-slate-600"
        aria-label="Close"
      >
        ✕
      </button>
      <button
        onClick={onClose}
        className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm transition-colors border border-slate-600"
      >
        ← Back
      </button>

      <h2 className="text-4xl font-black text-yellow-400 animate-pulse">
        🚨 GOLD PATH DETECTED: NONCE #{scannerResult.nonce}
      </h2>
      <p className="mt-2 text-2xl text-emerald-400">
        CONFIDENCE: {(confidence * 100).toFixed(2)}%
      </p>
      <p className="mt-1 text-sm text-gray-400 uppercase">
        Mode: {hashStatus === 'CRACKED' ? 'DETERMINISTIC' : 'PROBABILISTIC'}
      </p>
      <div className="grid gap-1 mt-6" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
        {Array.from({ length: gridSize * gridSize }, (_, i) => (
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

      {/* Dismiss button at bottom */}
      <button
        onClick={onClose}
        className="mt-6 px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors border border-slate-500"
      >
        Dismiss
      </button>
    </div>
  );
};
