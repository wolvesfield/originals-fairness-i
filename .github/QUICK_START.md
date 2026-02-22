# Neural-Entropy Suite — Quick Start

## Immediate Priorities

| Priority | Module | File | Status |
|----------|--------|------|--------|
| 0 | UHF Worker Pool | `src/workers/workerPool.ts` | ✅ Done |
| 0 | State Reconstruction Brain | `src/workers/aimingWorker.ts` | ✅ Done |
| 0 | Platform Game Algorithms | `src/workers/GameAlgorithms.ts` | ✅ Done |
| 1 | Hash-Space Explorer | `src/analysis/IntegrityAuditor.ts` | ✅ Done |
| 1 | Monte Carlo Density Map | `src/analysis/ClusterVarianceAnalyzer.ts` | ✅ Done |
| 2 | Kelly Criterion Allocator | `src/analysis/AllocationEngine.ts` | ✅ Done |
| 2 | Volatility Hedge | `src/analysis/VolatilityHedge.ts` | ✅ Done |
| 2 | Seed Harvester | `src/data/SeedHarvester.ts` | ✅ Done |
| 3 | Gold Path HUD | `src/components/GoldPathHUD.tsx` | ✅ Done |
| 3 | Mines Probability Grid | `src/components/MinesGrid.tsx` | ✅ Done |
| 3 | Future-Chain Sidebar | `src/components/FutureChainSidebar.tsx` | ✅ Done |
| 4 | Discord Telemetry | `src/telemetry/TelemetryDispatcher.ts` | ✅ Done |
| 4 | Master Controller | `src/controllers/MasterController.ts` | ✅ Done |
| 5 | PnL Backtester | `src/simulation/PnLSimulator.ts` | ✅ Done |
| 5 | CI/CD Pipeline | `.github/workflows/audit_pipeline.yml` | ✅ Done |

## Install Dependencies

```bash
npm install crypto-js
npm install -D @types/crypto-js @types/web jest @types/jest playwright
```

## GitHub Copilot Activation

Open Copilot Chat (`Ctrl+Shift+I`) and paste:

```
@workspace implement the Neural-Entropy Statistical Integrity Suite using complete instructions from .github/copilot-instructions.md. Deploy 4 parallel sub-agents: Alpha (Infrastructure), Beta (Statistics), Gamma (UI), Delta (Security). Start with Phase 1 modules. Use MCP memory for coordination. Target: 99.96% theoretical maximum win rate.
```

## Sub-Agent Assignments

| Agent | Focus | Modules |
|-------|-------|---------|
| **Alpha** | Infrastructure | `workerPool.ts`, `aimingWorker.ts`, `GameAlgorithms.ts` |
| **Beta** | Statistics | `ClusterVarianceAnalyzer.ts`, `AllocationEngine.ts`, `VolatilityHedge.ts` |
| **Gamma** | UI/UX | `GoldPathHUD.tsx`, `MinesGrid.tsx`, `FutureChainSidebar.tsx` |
| **Delta** | Security | `IntegrityAuditor.ts`, `TelemetryDispatcher.ts`, CI/CD |

## Environment Setup

```bash
cp .env.example .env
# Edit .env with real API keys
```

## Validate Foundation

```bash
npm run dev        # Dev server starts without errors
npm run baseline   # 10k-round baseline generation
npm run audit      # Python entropy audit
```

## Full Specs

See [copilot-instructions.md](copilot-instructions.md) for complete 15-module technical breakdown.