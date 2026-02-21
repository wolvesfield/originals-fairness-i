/**
 * CONTRACT VERIFIER — Task 4: Contract Root/Preimage Solver
 * Verifies SHA-256 preimages, validates hash chains,
 * performs dictionary attacks, and queries on-chain commitments.
 */
import 'dotenv/config';
import { createHash } from 'crypto';

export interface ChainValidationResult {
  valid: boolean;
  brokenAt?: number;
  totalChecked: number;
}

export class ContractVerifier {
  private rpcUrl: string;
  private contractAddress: string;

  constructor(
    rpcUrl: string = process.env.ETHEREUM_RPC_URL || '',
    contractAddress: string = process.env.CASINO_CONTRACT_ADDRESS || ''
  ) {
    this.rpcUrl = rpcUrl;
    this.contractAddress = contractAddress;
  }

  /** Verify that SHA-256(plaintext) === expectedHash */
  verifyPreimage(plaintext: string, expectedHash: string): boolean {
    const computed = createHash('sha256').update(plaintext).digest('hex');
    return computed.toLowerCase() === expectedHash.toLowerCase();
  }

  /** Validate a hash chain: each entry's hash should be SHA-256(seed) */
  validateHashChain(chain: Array<{ hash: string; seed: string }>): ChainValidationResult {
    let brokenAt: number | undefined;
    for (let i = 0; i < chain.length; i++) {
      const computed = createHash('sha256').update(chain[i].seed).digest('hex');
      if (computed.toLowerCase() !== chain[i].hash.toLowerCase()) {
        brokenAt = i;
        break;
      }
    }
    return { valid: brokenAt === undefined, brokenAt, totalChecked: chain.length };
  }

  /** Attempt to crack a hash by checking against a dictionary of known seeds */
  dictionaryAttack(targetHash: string, dictionary: string[]): string | null {
    const target = targetHash.toLowerCase();
    for (const candidate of dictionary) {
      const digest = createHash('sha256').update(candidate).digest('hex');
      if (digest === target) return candidate;
    }
    return null;
  }

  /** Generate a hash chain from a terminal seed */
  generateHashChain(terminalSeed: string, length: number): Array<{ hash: string; seed: string }> {
    const chain: Array<{ hash: string; seed: string }> = [];
    let currentSeed = terminalSeed;
    for (let i = 0; i < length; i++) {
      const hash = createHash('sha256').update(currentSeed).digest('hex');
      chain.push({ seed: currentSeed, hash });
      currentSeed = hash;
    }
    return chain;
  }

  /** Query on-chain commitment via JSON-RPC */
  async getOnChainCommitment(): Promise<string | null> {
    if (!this.rpcUrl || !this.contractAddress) return null;
    try {
      const fnSig = createHash('sha256').update('serverSeedHash()').digest('hex').slice(0, 8);
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_call',
          params: [{ to: this.contractAddress, data: '0x' + fnSig }, 'latest']
        })
      });
      const data = await response.json() as any;
      if (data.result && data.result !== '0x') {
        return data.result.replace('0x', '').slice(0, 64);
      }
    } catch (err) {
      console.error('[ContractVerifier] RPC error:', err);
    }
    return null;
  }
}

// CLI entry point
const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('ContractVerifier.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('ContractVerifier.js');

if (isMain) {
  const verifier = new ContractVerifier();

  // Demo: Generate and validate a hash chain
  const testSeed = 'demo-terminal-seed-abc123';
  console.log('═══ CONTRACT VERIFIER DEMO ═══\n');

  const chain = verifier.generateHashChain(testSeed, 5);
  console.log('Generated hash chain:');
  chain.forEach((entry, i) => {
    console.log(`  [${i}] seed: ${entry.seed.slice(0, 24)}... → hash: ${entry.hash.slice(0, 24)}...`);
  });

  const validation = verifier.validateHashChain(chain);
  console.log(`\nChain validation: ${validation.valid ? '✅ VALID' : '❌ BROKEN at index ' + validation.brokenAt}`);
  console.log(`Checked: ${validation.totalChecked} entries`);

  // Demo: Dictionary attack
  const targetHash = createHash('sha256').update(testSeed).digest('hex');
  const result = verifier.dictionaryAttack(targetHash, ['wrong-seed', testSeed, 'another-seed']);
  console.log(`\nDictionary attack on ${targetHash.slice(0, 16)}...`);
  console.log(`Result: ${result ? '🎯 FOUND: ' + result : '❌ NOT FOUND'}`);
}