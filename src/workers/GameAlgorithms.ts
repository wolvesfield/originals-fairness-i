export interface PlatformConfig {
  mines: { grids: number[]; hashFormat: string };
  keno: { range: [number, number]; draw: number };
  crash: { houseEdge: number; precision: number };
}

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  ROOBET: {
    mines: { grids: [25, 36, 49, 64], hashFormat: 'standard' },
    keno: { range: [1, 40], draw: 20 },
    crash: { houseEdge: 0.01, precision: 2 }
  },
  STAKE: {
    mines: { grids: [25, 36, 49], hashFormat: 'enhanced' },
    keno: { range: [1, 40], draw: 20 },
    crash: { houseEdge: 0.01, precision: 2 }
  }
};
