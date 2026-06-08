import { generateFloat, hmacSha256, hashToFloat } from './src/utils/fairnessEngine.ts';

for (let i = 0; i < 100; i++) {
  const hash = hmacSha256('serverSeed123', 'clientSeed456', 1, i);
  const expectedFloat = hashToFloat(hash);
  const actualFloat = generateFloat('serverSeed123', 'clientSeed456', 1, i);
  if (expectedFloat !== actualFloat) {
    console.error(`Mismatch at cursor ${i}: expected=${expectedFloat}, actual=${actualFloat}`);
    process.exit(1);
  }

  // also check roobet
  const hashRoobet = hmacSha256('serverSeed123', 'clientSeed456', 1, i, 'roobet');
  const expectedFloatRoobet = hashToFloat(hashRoobet);
  const actualFloatRoobet = generateFloat('serverSeed123', 'clientSeed456', 1, i, 'roobet');
  if (expectedFloatRoobet !== actualFloatRoobet) {
    console.error(`Mismatch at cursor ${i} (roobet): expected=${expectedFloatRoobet}, actual=${actualFloatRoobet}`);
    process.exit(1);
  }
}
console.log("All verifications passed!");
