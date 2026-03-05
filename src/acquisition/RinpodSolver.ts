import 'dotenv/config';

export class RinpodSolver {
    private apiKeys: string[];
    private baseUrl = 'https://api.runpod.io/graphql';

    constructor() {
        this.apiKeys = [
            process.env.RINPOD_API_KEY_1 || '',
            process.env.RINPOD_API_KEY_2 || ''
        ].filter(k => k.length > 0);
    }

    /**
     * Dispatches a hash solving payload to a Rinpod Serverless GPU instance.
     * This is intended for brute-forcing HMAC-SHA256 seeds when local CPU workers are too slow.
     */
    async dispatchHashToGPU(serverSeedHash: string, clientSeed: string, minNonce: number, maxNonce: number): Promise<string | null> {
        if (this.apiKeys.length === 0) {
            console.warn('[RinpodSolver] No API keys configured. Skipping GPU offload.');
            return null;
        }

        const apiKey = this.apiKeys[0]; // Use first available key for now

        // In a real implementation, this would point to a specific RunPod Serverless Endpoint ID
        // that hosts a hashcat or custom CUDA HMAC-SHA256 solver.
        const endpointId = process.env.RINPOD_ENDPOINT_ID || 'dummy-endpoint-for-now';
        const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;

        try {
            console.log(`[RinpodSolver] Dispatched ${serverSeedHash.slice(0, 16)}... to GPUs (${maxNonce - minNonce} nonces)`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    input: {
                        task: 'crack-hmac-sha256',
                        targetHash: serverSeedHash,
                        clientSeed: clientSeed,
                        rangeStart: minNonce,
                        rangeEnd: maxNonce
                    }
                }),
                signal: AbortSignal.timeout(30000) // GPUs should return within 30s
            });

            if (!response.ok) {
                throw new Error(`Rinpod API error: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'COMPLETED' && data.output && data.output.crackedSeed) {
                console.log(`[RinpodSolver] 🎯 GPU HIT! Seed found.`);
                return data.output.crackedSeed;
            }

            return null;
        } catch (err) {
            console.error('[RinpodSolver] Failed to communicate with GPU cluster:', err);
            return null;
        }
    }
}
