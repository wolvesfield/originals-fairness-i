import React, { memo } from 'react';

interface Prediction {
  nonce: number;
  confidence: number;
  isGold: boolean;
}

// Memoized to prevent unnecessary re-renders of the 50-item list.
export const FutureChainSidebar = memo<{ predictions: Prediction[] }>(({ predictions }) => {
  return (
    <div className="w-48 bg-slate-900 border-l border-slate-700 p-3 overflow-y-auto max-h-screen">
      <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Next 50 Nonces</h3>
      {predictions.map((pred) => (
        <div
          key={pred.nonce}
          className={`flex justify-between items-center py-1 px-2 rounded mb-1 text-xs ${
            pred.isGold ? 'bg-yellow-900/40 text-yellow-400 font-bold' : 'text-gray-500'
          }`}
        >
          <span>#{pred.nonce}</span>
          <span>{(pred.confidence * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
});
