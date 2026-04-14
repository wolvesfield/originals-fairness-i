/**
 * ORCHESTRATOR — Task 6: Workflow Automation
 * Automated pipeline: Stake Ingestion → Hash Cracking → Prediction → Analysis
 */
import 'dotenv/config';
import { StakeLiveRunner } from '../acquisition/StakeLiveRunner';
import { ContractVerifier } from '../acquisition/ContractVerifier';
import { SeedInfluenceAnalyzer } from '../analysis/SeedInfluenceAnalyzer';
import { createHash, createHmac } from 'crypto';

export class Orchestrator {
  private runner: StakeLiveRunner | null = null;
  private verifier: ContractVerifier;
  private analyzer: SeedInfluenceAnalyzer;
  private cycleCount = 0;
  private revealedSeeds: Array<{ serverSeed: string; clientSeed: string; nonce: number }> = [];

  constructor() {
    this.verifier = new ContractVerifier();
    this.analyzer = new SeedInfluenceAnalyzer();
  }

  async runAutomatedCycle(authToken: string): Promise<void> {
    if (!this.runner) this.runner = new StakeLiveRunner(authToken);
    this.cycleCount++;
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  CYCLE ${this.cycleCount} — ${new Date().toISOString()}`);
    console.log('═'.repeat(50));

    // Step 1: Ingest from Stake
    const liveData = await this.runner.runOnce();
    const balanceStr = liveData.balance.filter(b => b.amount > 0).map(b => `${b.amount} ${b.currency}`).join(', ') || '(zero)';
    console.log(`\n[1/5] 💰 Balance: ${balanceStr}`);
    console.log(`[2/5] 🔒 Hash: ${liveData.activeSeed.serverSeedHash.slice(0, 24)}... | Nonce: ${liveData.activeSeed.nonce}`);
    console.log(`[3/5] 🔑 Crack: ${liveData.crackStatus} | Dictionary: ${liveData.dictionarySize} seeds`);

    // Step 2: Verify previous seed chain integrity
    if (liveData.previousRevealed) {
      const prevHash = createHash('sha256').update(liveData.previousRevealed).digest('hex');
      const chainValid = this.verifier.verifyPreimage(liveData.previousRevealed, prevHash);
      console.log(`[4/5] ⛓️  Chain Integrity: ${chainValid ? '✅ VALID' : '❌ BROKEN'}`);

      // Accumulate revealed seeds for analysis
      this.revealedSeeds.push({
        serverSeed: liveData.previousRevealed,
        clientSeed: liveData.activeSeed.clientSeed,
        nonce: liveData.activeSeed.nonce
      });
    }

    // Step 3: If we have enough data, run seed influence analysis
    if (this.revealedSeeds.length >= 10 && this.cycleCount % 10 === 0) {
      const report = this.analyzer.analyze(this.revealedSeeds);
      console.log(`[5/5] 📊 Analysis (${report.totalRounds} rounds): χ²=${report.mineConcentration.chiSquare.toFixed(2)} | Impact=${(report.clientSeedImpact * 100).toFixed(1)}%`);
      console.log(`      ${report.recommendation}`);
    } else {
      console.log(`[5/5] 📊 Analysis: Collecting data (${this.revealedSeeds.length}/10 rounds)`);
    }

    // Step 4: Gold Path scan if seed is cracked
    if (liveData.crackedSeed) {
      console.log(`\n🎯 DETERMINISTIC MODE — Scanning next 50 nonces...`);
      const targetPattern = [0, 1, 2, 3, 4]; // Top row
      const goldNonces: number[] = [];

      for (let n = liveData.activeSeed.nonce; n < liveData.activeSeed.nonce + 50; n++) {
        const hash = createHmac('sha256', liveData.crackedSeed)
          .update(`${liveData.activeSeed.clientSeed}:${n}:0`)
          .digest('hex');
        const mines = this.mapHashToMines(hash, 3, 25);
        const isGold = !targetPattern.some(t => mines.includes(t));
        if (isGold) goldNonces.push(n);
      }

      if (goldNonces.length > 0) {
        console.log(`   🥇 GOLD NONCES: ${goldNonces.join(', ')}`);
        console.log(`   📍 Next safe play at nonce #${goldNonces[0]}`);
      } else {
        console.log(`   ⚠️  No gold paths in next 50 nonces for top-row target`);
      }
    }
  }

  private mapHashToMines(hash: string, mineCount: number, gridSize: number): number[] {
    const positions = Array.from({ length: gridSize }, (_, i) => i);
    const mines: number[] = [];
    let idx = 0;
    while (mines.length < mineCount) {
      const seg = hash.substring(idx, idx + 2);
      const ptr = parseInt(seg, 16) % positions.length;
      mines.push(positions.splice(ptr, 1)[0]);
      idx += 2;
      if (idx >= 60) {
        hash = createHash('sha256').update(hash).digest('hex');
        idx = 0;
      }
    }
    return mines;
  }

  async startLoop(authToken: string, intervalMs: number = 10000): Promise<void> {
    console.log('╔══════════════════════════════════════╗');
    console.log('║   NEURAL-ENTROPY ORCHESTRATOR v1.0   ║');
    console.log('║   Automated Pipeline Active          ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`Polling every ${intervalMs / 1000}s...\n`);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.runAutomatedCycle(authToken);
      } catch (err) {
        console.error('[Orchestrator] Cycle error:', err);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}

// CLI entry point
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('Orchestrator.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('Orchestrator.js');

if (isMain) {
  const token = process.env.STAKE_AUTH_TOKEN;
  if (!token) { console.error('Set STAKE_AUTH_TOKEN in .env'); process.exit(1); }
  new Orchestrator().startLoop(token);
}