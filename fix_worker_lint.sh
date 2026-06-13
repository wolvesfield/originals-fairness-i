sed -i 's/function hmacSha256/function _hmacSha256/g' src/workers/aimingWorker.ts
sed -i 's/function hashToFloat/function _hashToFloat/g' src/workers/aimingWorker.ts
sed -i 's/function generateMinePositions/function _generateMinePositions/g' src/workers/aimingWorker.ts
