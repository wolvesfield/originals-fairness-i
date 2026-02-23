# Project Status & Action Items

## Phase 0: Foundation (Complete)
- [x] Task 1 – DB Baseline/Sanity (SQLite baseline generated with 10,000 records; checksum: `7108a63e6923381672ac9ec8b2215e70ef40123304fc3abeaf9f3290fd459a4b`)
- [x] Task 2 – Integrity Verification Logic (HMAC_SHA256 and deterministic fairness helpers for Mines/Keno/Crash)
- [x] Task 5 – Entropy Auditor (metrics JSON validated on 10,000-game baseline)
- [x] Task 7 – Spark KV Persistence (verification history persisted in Spark KV)
- [x] Task 9 – UHF Worker Pool (4× parallel worker architecture with SharedArrayBuffer)
- [x] Task 10 – Monte Carlo Convergence (50k density mapping via ClusterVarianceAnalyzer)
- [x] Task 11 – Asymmetric Volatility Hedge (Gaussian variance circuit breaker)
- [x] Task 12 – Hashes.com Integration (Distributed Hash-Space Explorer)
- [x] Task 13 – Gold Path HUD (real-time tactical overlay with dismissable modal)
- [x] Task 14 – Email Telemetry (SMTP alert dispatch on ≥92% confidence)
- [x] Task 15 – PnL Simulator (walk-forward backtesting engine)
- [x] Task 16 – CI/CD Pipeline (24/7 automated entropy monitoring)

## Phase 9: Roadmap Gap Analysis (Complete — commits 8be7339, 7937422)
- [x] Fisher-Yates algorithm fix in `aimingWorker.ts` — matches `fairnessEngine.ts` exactly
- [x] SharedArrayBuffer + Atomics in `workerPool.ts` — Int32Array[3]: scanned/found/nonce
- [x] COOP/COEP headers in `vite.config.ts` — enables SharedArrayBuffer in browsers
- [x] Target tile painting in `MinesGame.tsx` — amber-styled interactive tile selection
- [x] Keno user picks in `KenoGame.tsx` — interactive number picking UI (1-40, max 10)
- [x] Express API bridge (`src/server/express.ts`) — /aim/mines, /aim/keno, /aim/crash
- [x] devcontainer.json — Node 22, Python 3.12, ports 5173/3737
- [x] Distributed workflow (`.github/workflows/brute_force_distributed.yml`) + `scripts/distributedScan.ts`
- [x] OpSec traffic mimicry (`src/utils/opsec.ts`) — Poisson delay, dictionary seeds, fingerprint rotation

## Phase 10: Architecture Fix & Hardening (Current)
- [x] **CRITICAL FIX:** Removed client-side forbidden header injection from `ApiConnections.tsx`
  - Browsers silently drop `Origin`, `User-Agent`, `Referer`, `sec-ch-ua`, `sec-fetch-*` in `fetch()`
  - All browser-mimicking headers now exclusively in Cloudflare Worker proxy (`worker/cors-proxy-worker.js`)
  - `stakeHeaders()` reduced to safe headers only: `Accept`, `Content-Type`, `x-access-token`, `x-language`
  - `resilientFetch()` cleaned of auto-injection logic
- [x] Python audit script (`scripts/stake_audit.py`) — Stake GraphQL: balances, seeds, bet history
- [x] Keno `onUserPicksChange` wired in `App.tsx` for analysis integration
- [x] Worker math verified: Fisher-Yates, Keno set-based, Crash formula all match `fairnessEngine.ts`

## Pending / In Progress
- [ ] Task 3 – Authenticated State Ingestion (Stake API driver implemented; first live authenticated run pending)
- [ ] Task 4 – Contract Root/Preimage Solver (smart-contract verifier implemented; live verification pending)
- [ ] Task 6 – Workflow Automation & Alerting (manual workflows exist; full automation pending)
- [ ] Task 8 – Seed Influence Analysis (foundational decoders exist; formal pipeline pending)
- [ ] Cloudflare Worker deployment (see `worker/cors-proxy-worker.js` — required for reliable Stake API access)

## Architecture Notes
- **Header Injection:** ALL browser-mimicking headers (Origin, UA, sec-ch-ua, sec-fetch-*) are injected server-side by the Cloudflare Worker proxy. The React frontend NEVER sets forbidden headers.
- **Proxy Chain:** React UI → CORS Proxy (corsproxy.io or custom Cloudflare Worker) → Stake/Roobet API
- **Worker Pool:** 4× parallel Web Workers with SharedArrayBuffer for progress tracking and kill-switch coordination
- **Math:** Fisher-Yates (Mines), Set-based collision avoidance (Keno), HMAC+h%33 house edge (Crash)

