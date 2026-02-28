import { jest } from '@jest/globals';
import { ContractVerifier } from '../../acquisition/ContractVerifier';
import { createHash } from 'crypto';

describe('ContractVerifier', () => {
  let verifier: ContractVerifier;

  beforeEach(() => {
    // Provide dummy env variables so fetch won't be bypassed if testing RPC
    verifier = new ContractVerifier('http://dummy.rpc', '0xdummyContract');
  });

  describe('verifyPreimage', () => {
    it('returns true when the plaintext matches the expected hash', () => {
      const plaintext = 'test-seed-123';
      const expectedHash = createHash('sha256').update(plaintext).digest('hex');
      expect(verifier.verifyPreimage(plaintext, expectedHash)).toBe(true);
    });

    it('returns true regardless of hash case', () => {
      const plaintext = 'test-seed-upper';
      const expectedHash = createHash('sha256').update(plaintext).digest('hex').toUpperCase();
      expect(verifier.verifyPreimage(plaintext, expectedHash)).toBe(true);
    });

    it('returns false when the plaintext does not match the expected hash', () => {
      const plaintext = 'test-seed-wrong';
      const expectedHash = createHash('sha256').update('different-seed').digest('hex');
      expect(verifier.verifyPreimage(plaintext, expectedHash)).toBe(false);
    });
  });

  describe('generateHashChain', () => {
    it('generates a hash chain of the specified length', () => {
      const terminalSeed = 'terminal-123';
      const chain = verifier.generateHashChain(terminalSeed, 5);
      expect(chain).toHaveLength(5);
    });

    it('generates sequential hashes correctly', () => {
      const terminalSeed = 'terminal-123';
      const chain = verifier.generateHashChain(terminalSeed, 3);

      const expectedHash0 = createHash('sha256').update(terminalSeed).digest('hex');
      expect(chain[0]).toEqual({ seed: terminalSeed, hash: expectedHash0 });

      const expectedHash1 = createHash('sha256').update(expectedHash0).digest('hex');
      expect(chain[1]).toEqual({ seed: expectedHash0, hash: expectedHash1 });

      const expectedHash2 = createHash('sha256').update(expectedHash1).digest('hex');
      expect(chain[2]).toEqual({ seed: expectedHash1, hash: expectedHash2 });
    });
  });

  describe('validateHashChain', () => {
    it('returns valid for a correctly generated hash chain', () => {
      const terminalSeed = 'terminal-abc';
      const chain = verifier.generateHashChain(terminalSeed, 10);
      const result = verifier.validateHashChain(chain);
      expect(result.valid).toBe(true);
      expect(result.brokenAt).toBeUndefined();
      expect(result.totalChecked).toBe(10);
    });

    it('returns invalid if a link in the chain is broken', () => {
      const terminalSeed = 'terminal-broken';
      const chain = verifier.generateHashChain(terminalSeed, 5);

      // Tamper with index 2
      chain[2].hash = '0000000000000000000000000000000000000000000000000000000000000000';

      const result = verifier.validateHashChain(chain);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(2);
    });
  });

  describe('dictionaryAttack', () => {
    it('returns the plaintext candidate if found in dictionary', () => {
      const targetPlaintext = 'target-seed';
      const targetHash = createHash('sha256').update(targetPlaintext).digest('hex');
      const dictionary = ['wrong-seed-1', 'wrong-seed-2', targetPlaintext, 'wrong-seed-3'];

      const result = verifier.dictionaryAttack(targetHash, dictionary);
      expect(result).toBe(targetPlaintext);
    });

    it('returns null if candidate is not found in dictionary', () => {
      const targetPlaintext = 'target-seed';
      const targetHash = createHash('sha256').update(targetPlaintext).digest('hex');
      const dictionary = ['wrong-seed-1', 'wrong-seed-2', 'wrong-seed-3'];

      const result = verifier.dictionaryAttack(targetHash, dictionary);
      expect(result).toBeNull();
    });

    it('works with uppercase target hashes', () => {
      const targetPlaintext = 'target-seed';
      const targetHash = createHash('sha256').update(targetPlaintext).digest('hex').toUpperCase();
      const dictionary = ['wrong-seed-1', targetPlaintext];

      const result = verifier.dictionaryAttack(targetHash, dictionary);
      expect(result).toBe(targetPlaintext);
    });
  });

  describe('getOnChainCommitment', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('returns null if no rpcUrl or contractAddress is provided', async () => {
      const emptyVerifier = new ContractVerifier('', '');
      const result = await emptyVerifier.getOnChainCommitment();
      expect(result).toBeNull();
    });

    it('returns the commit hash on a successful RPC call', async () => {
      const expectedCommit = 'a'.repeat(64);

      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          result: '0x' + expectedCommit
        })
      } as unknown as Response);

      const result = await verifier.getOnChainCommitment();
      expect(result).toBe(expectedCommit);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('returns null if the result is empty or 0x', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          result: '0x'
        })
      } as unknown as Response);

      const result = await verifier.getOnChainCommitment();
      expect(result).toBeNull();
    });

    it('returns null and swallows error on fetch failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await verifier.getOnChainCommitment();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
