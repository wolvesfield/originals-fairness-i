/**
 * STAKE LIVE RUNNER — Task 3: Authenticated State Ingestion
 * Connects to Stake API, pulls seeds, auto-harvests revealed seeds,
 * attempts hash cracking, and builds a growing seed dictionary.
 */
import 'dotenv/config';
import { createHash } from 'crypto';
import { StakeApiClient } from './stakeApi';
import { IntegrityAuditor } from '../analysis/IntegrityAuditor';

export interface LiveRunResult {
  balance: { currency: string; amount: number }[];
  activeSeed: { serverSeedHash: string; clientSeed: string; nonce: number };
  previousRevealed?: string;
  crackStatus: 'CRACKED' | 'SEARCHING' | 'UNKNOWN';
  crackedSeed: string | null;
  historyCount: number;
  dictionarySize: number;
}

export class StakeLiveRunner {
  private client: StakeApiClient;
  private auditor: IntegrityAuditor;
  private seedDictionary: Map<string, string> = new Map();
  private pollingIntervalMs = 5000;
  private isRunning = false;

  constructor(authToken: string) {
    this.client = new StakeApiClient({ authToken });
    this.auditor = new IntegrityAuditor();
  }

  async runOnce(): Promise<LiveRunResult> {
    // 1. Pull balances
    const balance = await this.client.getBalances();

    // 2. Pull active seed pair + previous revealed seed
    const seedPair = await this.client.getActiveSeedPair();

    // 3. If previousServerSeed exists, harvest it
    if (seedPair.previousServerSeed) {
      const hash = createHash('sha256').update(seedPair.previousServerSeed).digest('hex');
      if (!this.seedDictionary.has(hash)) {
        this.seedDictionary.set(hash, seedPair.previousServerSeed);
        console.log(`[Harvester] Cached: ${hash.slice(0, 16)}... → ${seedPair.previousServerSeed.slice(0, 16)}...`);
      }
    }

    // 4. Try cracking the CURRENT active server seed hash
    let crackStatus: 'CRACKED' | 'SEARCHING' | 'UNKNOWN' = 'UNKNOWN';
    let crackedSeed: string | null = null;

    // Check local dictionary first
    const localMatch = this.seedDictionary.get(seedPair.serverSeedHash);
    if (localMatch) {
      crackedSeed = localMatch;
      crackStatus = 'CRACKED';
      console.log(`[Cracker] 🎯 LOCAL HIT: ${seedPair.serverSeedHash.slice(0, 16)}...`);
    } else {
      crackStatus = 'SEARCHING';
      crackedSeed = await this.auditor.resolveServerSeed(seedPair.serverSeedHash);
      if (crackedSeed) {
        crackStatus = 'CRACKED';
        this.seedDictionary.set(seedPair.serverSeedHash, crackedSeed);
        console.log(`[Cracker] 🎯 API HIT: ${seedPair.serverSeedHash.slice(0, 16)}...`);
      }
    }

    // 5. Pull bet history to backfill dictionary
    let historyCount = 0;
    try {
      const history = await this.client.myBetHistorySeeds({ limit: 50 });
      historyCount = history.length;
    } catch {
      // Non-critical
    }

    return {
      balance,
      activeSeed: {
        serverSeedHash: seedPair.serverSeedHash,
        clientSeed: seedPair.clientSeed,
        nonce: seedPair.nonce
      },
      previousRevealed: seedPair.previousServerSeed,
      crackStatus,
      crackedSeed,
      historyCount,
      dictionarySize: this.seedDictionary.size
    };
  }

  async startPolling(onUpdate: (data: LiveRunResult) => void): Promise<void> {
    this.isRunning = true;
    console.log('[StakeLiveRunner] Starting polling loop...');
    while (this.isRunning) {
      try {
        const data = await this.runOnce();
        onUpdate(data);
      } catch (err) {
        console.error('[StakeLiveRunner] Poll error:', err);
      }
      await new Promise(r => setTimeout(r, this.pollingIntervalMs));
    }
  }

  stop(): void { this.isRunning = false; }
}

// CLI entry point
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('StakeLiveRunner.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('StakeLiveRunner.js');

if (isMain) {
  const token = process.env.STAKE_AUTH_TOKEN;
  if (!token) { console.error('Set STAKE_AUTH_TOKEN in .env'); process.exit(1); }

  const runner = new StakeLiveRunner(token);
  runner.startPolling((data) => {
    console.log(`\n═══ ${new Date().toISOString()} ═══`);
    console.log(`Balance: ${data.balance.filter(b => b.amount > 0).map(b => `${b.amount} ${b.currency}`).join(', ') || '(zero)'}`);
    console.log(`Server Hash: ${data.activeSeed.serverSeedHash.slice(0, 24)}...`);
    console.log(`Client Seed: ${data.activeSeed.clientSeed} | Nonce: ${data.activeSeed.nonce}`);
    console.log(`Crack Status: ${data.crackStatus} | Dictionary: ${data.dictionarySize} seeds`);
    if (data.crackedSeed) console.log(`🎯 CRACKED SEED: ${data.crackedSeed.slice(0, 32)}...`);
  });
}