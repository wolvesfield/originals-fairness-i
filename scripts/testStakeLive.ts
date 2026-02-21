/**
 * Quick Stake API Live Test
 * Run: npx tsx scripts/testStakeLive.ts
 */
import 'dotenv/config';
import { StakeApiClient } from '../src/acquisition/stakeApi';

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  STAKE.COM LIVE CONNECTION TEST');
  console.log('═══════════════════════════════════════\n');

  const token = process.env.STAKE_AUTH_TOKEN;
  if (!token) {
    console.error('❌ STAKE_AUTH_TOKEN not set in .env');
    process.exit(1);
  }
  console.log(`🔑 Token: ${token.slice(0, 12)}...${token.slice(-8)}\n`);

  const client = new StakeApiClient({ authToken: token });

  // Test 1: Balances
  console.log('─── TEST 1: Balances ───');
  try {
    const balances = await client.getBalances();
    const nonZero = balances.filter(b => b.amount > 0);
    if (nonZero.length > 0) {
      nonZero.forEach(b => console.log(`  💰 ${b.amount} ${b.currency.toUpperCase()}`));
    } else {
      console.log('  (no non-zero balances)');
    }
    console.log('  ✅ Balance query OK\n');
  } catch (err: any) {
    console.error('  ❌ Balance query failed:', err.message, '\n');
  }

  // Test 2: Active Seed Pair
  console.log('─── TEST 2: Active Seed Pair ───');
  try {
    const seeds = await client.getActiveSeedPair();
    console.log(`  🔒 Server Hash:  ${seeds.serverSeedHash || '(empty)'}`);
    console.log(`  🎲 Client Seed:  ${seeds.clientSeed || '(empty)'}`);
    console.log(`  📊 Nonce:        ${seeds.nonce}`);
    if (seeds.previousServerSeed) {
      console.log(`  🔓 Prev Seed:    ${seeds.previousServerSeed.slice(0, 24)}...`);
      console.log(`  🔓 Prev Hash:    ${seeds.previousServerSeedHash || '(empty)'}`);
    } else {
      console.log('  🔓 Prev Seed:    (none — rotate seeds on Stake to reveal)');
    }
    console.log('  ✅ Seed pair query OK\n');
  } catch (err: any) {
    console.error('  ❌ Seed pair query failed:', err.message, '\n');
  }

  // Test 3: Bet History
  console.log('─── TEST 3: Bet History (last 5) ───');
  try {
    const history = await client.myBetHistorySeeds({ limit: 5 });
    if (history.length > 0) {
      history.forEach((h, i) => {
        console.log(`  [${i + 1}] ${h.game || 'unknown'} | nonce: ${h.nonce} | client: ${h.clientSeed?.slice(0, 12)}... | hash: ${h.activeServerSeedCommitment?.slice(0, 16)}...`);
      });
    } else {
      console.log('  (no bet history with seeds found)');
    }
    console.log('  ✅ History query OK\n');
  } catch (err: any) {
    console.error('  ❌ History query failed:', err.message, '\n');
  }

  console.log('═══════════════════════════════════════');
  console.log('  ALL TESTS COMPLETE');
  console.log('═══════════════════════════════════════');
}

main().catch(console.error);