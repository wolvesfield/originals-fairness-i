/**
 * Ultra-High Frequency Worker Pool
 * Manages 4× parallel aimingWorker.ts instances
 * Implements kill-switch coordination and load balancing
 */
export class UHFWorkerPool {
  private workers: Worker[] = [];
  private activeScans: Map<string, Promise<any>> = new Map();

  constructor() {
    const coreCount = navigator.hardwareConcurrency || 4;
    for (let i = 0; i < coreCount; i++) {
      this.workers.push(new Worker(new URL('./aimingWorker.ts', import.meta.url), { type: 'module' }));
    }
  }

  async executeExhaustiveScan(
    startNonce: number,
    lookAhead: number,
    serverSeed: string,
    clientSeed: string,
    targetPattern: number[]
  ): Promise<{ found: boolean; nonce?: number; safePath?: number[] }> {
    const chunkSize = Math.ceil(lookAhead / this.workers.length);

    return new Promise((resolve) => {
      let resolved = false;

      this.workers.forEach((worker, idx) => {
        const chunkStart = startNonce + idx * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize - 1, startNonce + lookAhead - 1);

        worker.onmessage = (e) => {
          if (resolved) return;
          if (e.data.found) {
            resolved = true;
            // Kill-switch: terminate all other workers
            this.workers.forEach((w, j) => { if (j !== idx) w.terminate(); });
            resolve(e.data);
          }
        };

        worker.postMessage({
          type: 'SCAN_CHUNK',
          payload: { startNonce: chunkStart, endNonce: chunkEnd, serverSeed, clientSeed, targetPattern }
        });
      });
    });
  }

  terminate(): void {
    this.workers.forEach((w) => w.terminate());
  }
}
