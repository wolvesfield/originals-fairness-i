export interface BetHistoryRecord {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  payoutMultiplier: number;
  gameType: string;
}

export class SeedHarvester {
  private baseUrl: string;

  constructor(apiEndpoint: string) {
    this.baseUrl = apiEndpoint;
  }

  async ingestHistoricalSeeds(limit: number = 1000): Promise<BetHistoryRecord[]> {
    try {
      const response = await fetch(`${this.baseUrl}/history?limit=${limit}`);
      const data = await response.json();
      return data.map((round: any) => ({
        serverSeed: round.serverSeedRevealed || round.serverSeed,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
        payoutMultiplier: round.payout || 1,
        gameType: round.game || 'MINES'
      }));
    } catch (error) {
      console.error('[Harvester] Ingestion error:', error);
      return [];
    }
  }
}
