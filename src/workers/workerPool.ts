/**
 * Ultra-High Frequency Worker Pool
 * Manages N parallel aimingWorker.ts instances (one per logical core).
 *
 * Features:
 *  - SharedArrayBuffer + Atomics for inter-worker coordination
 *  - Kill-switch: first worker to find a result signals all others to stop
 *  - Progress tracking: real-time scanned count accessible from main thread
 *  - Nonce-pivot: can restart scan from a different nonce range mid-flight
 *  - Game-type support: Mines/Keno/Crash with configurable parameters
 */

export interface ScanConfig {
  startNonce: number;
  lookAhead: number;
  serverSeed: string;
  clientSeed: string;
  targetPattern: number[];
  gameType?: 'MINES' | 'KENO' | 'CRASH';
  gameConfig?: {
    mineCount?: number;
    totalCells?: number;
    drawCount?: number;
    maxNum?: number;
    targetMultiplier?: number;
    minKenoHits?: number;
  };
}

export interface ScanResult {
  found: boolean;
  nonce?: number;
  safePath?: number[];
  scannedCount?: number;
  elapsed?: number;
}

export class UHFWorkerPool {
  private workers: Worker[] = [];
  private workerCount: number;
  private progressBuffer: SharedArrayBuffer | null = null;
  private progressView: Int32Array | null = null;

  constructor() {
    this.workerCount = typeof navigator !== 'undefined'
      ? (navigator.hardwareConcurrency || 4)
      : 4;
    this.spawnWorkers();
  }

  private spawnWorkers(): void {
    // Terminate existing workers
    this.workers.forEach(w => { try { w.terminate(); } catch { /* ignore */ } });
    this.workers = [];

    for (let i = 0; i < this.workerCount; i++) {
      this.workers.push(
        new Worker(new URL('./aimingWorker.ts', import.meta.url), { type: 'module' })
      );
    }
  }

  /**
   * Check if SharedArrayBuffer is available (requires COOP/COEP headers).
   * Falls back to postMessage-only mode if not.
   */
  private get sharedMemoryAvailable(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
  }

  /**
   * Get current scan progress (scanned nonces count).
   * Only works when SharedArrayBuffer is available.
   */
  getProgress(): { scanned: number; found: boolean; foundNonce: number } {
    if (!this.progressView) return { scanned: 0, found: false, foundNonce: -1 };
    return {
      scanned: Atomics.load(this.progressView, 0),
      found: Atomics.load(this.progressView, 1) === 1,
      foundNonce: Atomics.load(this.progressView, 2),
    };
  }

  /**
   * Execute a brute-force scan across all workers.
   * Divides the nonce range into chunks, one per worker.
   */
  async executeExhaustiveScan(
    startNonce: number,
    lookAhead: number,
    serverSeed: string,
    clientSeed: string,
    targetPattern: number[],
    gameType: 'MINES' | 'KENO' | 'CRASH' = 'MINES',
    gameConfig: ScanConfig['gameConfig'] = {}
  ): Promise<ScanResult> {
    const t0 = performance.now();

    // Respawn workers (they may have been terminated by a previous kill-switch)
    this.spawnWorkers();

    // Allocate SharedArrayBuffer for progress: [scanned, found, foundNonce]
    let progressBuffer: SharedArrayBuffer | undefined;
    if (this.sharedMemoryAvailable) {
      this.progressBuffer = new SharedArrayBuffer(3 * Int32Array.BYTES_PER_ELEMENT);
      this.progressView = new Int32Array(this.progressBuffer);
      Atomics.store(this.progressView, 0, 0);
      Atomics.store(this.progressView, 1, 0);
      Atomics.store(this.progressView, 2, -1);
      progressBuffer = this.progressBuffer;
    }

    const chunkSize = Math.ceil(lookAhead / this.workers.length);

    return new Promise<ScanResult>((resolve) => {
      let resolved = false;
      let completedWorkers = 0;

      this.workers.forEach((worker, idx) => {
        const chunkStart = startNonce + idx * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize - 1, startNonce + lookAhead - 1);

        if (chunkStart > startNonce + lookAhead - 1) {
          completedWorkers++;
          if (completedWorkers === this.workers.length && !resolved) {
            resolved = true;
            resolve({ found: false, scannedCount: lookAhead, elapsed: performance.now() - t0 });
          }
          return;
        }

        worker.onmessage = (e: MessageEvent) => {
          if (resolved) return;

          if (e.data.found) {
            resolved = true;
            resolve({
              found: true,
              nonce: e.data.nonce,
              safePath: e.data.safePath,
              scannedCount: this.getProgress().scanned || lookAhead,
              elapsed: performance.now() - t0
            });
          } else {
            completedWorkers++;
            if (completedWorkers === this.workers.length && !resolved) {
              resolved = true;
              resolve({
                found: false,
                scannedCount: this.getProgress().scanned || lookAhead,
                elapsed: performance.now() - t0
              });
            }
          }
        };

        worker.onerror = () => {
          completedWorkers++;
          if (completedWorkers === this.workers.length && !resolved) {
            resolved = true;
            resolve({ found: false, scannedCount: this.getProgress().scanned || 0, elapsed: performance.now() - t0 });
          }
        };

        worker.postMessage({
          type: 'SCAN_CHUNK',
          payload: {
            startNonce: chunkStart,
            endNonce: chunkEnd,
            serverSeed,
            clientSeed,
            targetPattern,
            gameType,
            gameConfig,
            progressBuffer
          }
        });
      });
    });
  }

  /**
   * Nonce-pivot: abort current scan and restart from a new nonce.
   * Uses the Atomics found-flag to signal workers to stop.
   */
  async pivotScan(config: ScanConfig): Promise<ScanResult> {
    // Signal existing workers to stop via Atomics
    if (this.progressView) {
      Atomics.store(this.progressView, 1, 1); // Set found flag to trigger early exit
    }

    // Small delay to let workers process the signal
    await new Promise(r => setTimeout(r, 10));

    return this.executeExhaustiveScan(
      config.startNonce,
      config.lookAhead,
      config.serverSeed,
      config.clientSeed,
      config.targetPattern,
      config.gameType,
      config.gameConfig
    );
  }

  terminate(): void {
    this.workers.forEach((w) => { try { w.terminate(); } catch { /* ignore */ } });
    this.workers = [];
  }
}
