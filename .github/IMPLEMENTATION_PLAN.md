# Implementation Plan — Provably Fair Statistical Integrity Suite

## Architecture Overview

```
originals-fairness-i/
├── src/
│   ├── acquisition/      # Data ingestion (Stake API, live WebSocket, hash cracking, contract verification)
│   ├── analysis/          # Statistical engines (Monte Carlo, cluster variance, seed influence, integrity auditor)
│   ├── automation/        # Pipeline orchestration (Orchestrator)
│   ├── components/        # React UI components (games, HUD, config, batch verification)
│   │   └── ui/            # shadcn/Radix primitive components
│   ├── controllers/       # MasterController (deterministic + probabilistic game-round processing)
│   ├── data/              # SeedHarvester (historical bet record fetching)
│   ├── db/                # SQLite layer (better-sqlite3, verified_seeds + root_hashes tables)
│   ├── hooks/             # React hooks (use-mobile)
│   ├── lib/               # Shared utilities (crypto, types, utils)
│   ├── server/api/        # Dev-only API endpoints (seeds query)
│   ├── simulation/        # PnL simulator (Monte Carlo P&L modeling)
│   ├── styles/            # Theme CSS
│   ├── telemetry/         # Alert dispatch (Telegram, Discord, webhook notifications)
│   ├── utils/             # Fairness engine (HMAC-SHA256 provably-fair verification)
│   └── workers/           # Web workers (aiming worker, game algorithms, worker pool)
├── scripts/               # CLI tools (baseline generator, entropy auditor, live scraper, contract verifier)
├── database/              # SQLite data store (audit_store.db) — gitignored
└── .github/               # CI/CD workflows, docs
```

## Module Status

| Module | File | Status |
|--------|------|--------|
| Fairness Engine | `src/utils/fairnessEngine.ts` | ✅ Complete |
| Crypto Utilities | `src/lib/crypto.ts` | ✅ Complete |
| Type Definitions | `src/lib/types.ts` | ✅ Complete |
| SQLite DB Layer | `src/db/db.ts` | ✅ Complete |
| Stake API Client | `src/acquisition/stakeApi.ts` | ✅ Complete |
| Stake Live Runner | `src/acquisition/StakeLiveRunner.ts` | ✅ Complete |
| Live Stream Ingestor | `src/acquisition/liveStream.ts` | ✅ Complete |
| Hash Cracker | `src/acquisition/hashCracker.ts` | ✅ Complete |
| Contract Verifier | `src/acquisition/ContractVerifier.ts` | ✅ Complete |
| Seed Harvester | `src/data/SeedHarvester.ts` | ✅ Complete |
| Cluster Variance Analyzer | `src/analysis/ClusterVarianceAnalyzer.ts` | ✅ Complete |
| Integrity Auditor | `src/analysis/IntegrityAuditor.ts` | ✅ Complete |
| Seed Influence Analyzer | `src/analysis/SeedInfluenceAnalyzer.ts` | ✅ Complete |
| Allocation Engine | `src/analysis/AllocationEngine.ts` | ✅ Complete |
| Volatility Hedge | `src/analysis/VolatilityHedge.ts` | ✅ Complete |
| PnL Simulator | `src/simulation/PnLSimulator.ts` | ✅ Complete |
| Telemetry Dispatcher | `src/telemetry/TelemetryDispatcher.ts` | ✅ Complete |
| Worker Pool | `src/workers/workerPool.ts` | ✅ Complete |
| Aiming Worker | `src/workers/aimingWorker.ts` | ✅ Complete |
| Game Algorithms | `src/workers/GameAlgorithms.ts` | ✅ Complete |
| Master Controller | `src/controllers/MasterController.ts` | ✅ Complete |
| Orchestrator | `src/automation/Orchestrator.ts` | ✅ Complete |
| React UI (all components) | `src/components/*.tsx` | ✅ Complete |
| Baseline Generator | `scripts/generateBaseline.ts` | ✅ Complete |
| Entropy Auditor (Python) | `scripts/entropy_auditor.py` | ✅ Complete |
| Live Scraper | `scripts/liveScraper.ts` | ✅ Complete |
| CI Pipeline | `.github/workflows/audit_pipeline.yml` | ✅ Complete |

## Build & Run

```bash
# Install dependencies
npm install

# Generate baseline dataset (10k seeds)
npm run baseline

# Start dev server
npm run dev

# Production build
npm run build

# Run entropy audit (Python)
npm run audit

# Run Monte Carlo analysis
npm run monte-carlo

# Run full orchestration pipeline
npm run orchestrate
```

## Key Design Decisions

1. **Dual-mode processing**: MasterController operates in DETERMINISTIC mode (when server seed is cracked via HMAC-SHA256 preimage lookup) or PROBABILISTIC mode (Monte Carlo statistical fallback via heat maps).
2. **Hash chain verification**: Server seeds form a reverse SHA-256 chain; integrity is verified by ensuring each plaintext hashes forward to the next entry.
3. **Real cryptographic verification**: All game outcome verification uses actual HMAC-SHA256 (via `crypto-js`). Mine positions use Fisher-Yates shuffle seeded by HMAC output. No toy/stub hash functions.
4. **Multi-channel alerts**: TelemetryDispatcher supports Discord webhooks, SMTP email, and console fallback. Only fires when confidence ≥ 92%.
5. **Browser + Node hybrid**: Frontend uses `crypto-js` for browser-compatible HMAC-SHA256; backend scripts use Node's native `crypto` module.
6. **SQLite persistence**: `better-sqlite3` stores verified seeds and root hashes locally; excluded from git via `.gitignore`.
7. **Worker threads**: CPU-intensive game algorithm calculations are offloaded to web workers via a managed pool.
8. **No AI/ML/Neural Networks**: This suite uses deterministic cryptographic algorithms and classical statistics (Monte Carlo, chi-square, Kelly Criterion). There are no neural networks, machine learning models, or agent training systems.
