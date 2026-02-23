## Operations & Runbook

This document centralizes installation, environment configuration, and common operational commands. It consolidates content that was previously in `README.md`, `.github/QUICK_START.md`, and `AGENT_HANDOVER.md`.

### Local Development Setup

#### Prerequisites

- Node.js 20+ (or the version configured in `.devcontainer/devcontainer.json`).
- Python 3.12 (for entropy auditing and related scripts).
- Git and a modern browser.

#### Install Dependencies

```bash
# JavaScript/TypeScript dependencies
npm install

# (Optional) Python virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables

Copy `.env.example` to `.env` and provide real values:

```bash
cp .env.example .env
```

Key variables (see `.env.example` for the full list):

- `HASHES_API_KEY` — Hashes.com API key.
- `STAKE_AUTH_TOKEN` — Stake.com session token.
- `ETHEREUM_RPC_URL` — Ethereum JSON-RPC endpoint.
- `CASINO_CONTRACT_ADDRESS` — On-chain contract address to verify roots against.
- `DISCORD_WEBHOOK_URL` — Discord telemetry channel webhook.

Optional integration keys:

- `TAVILY_API_KEY`, `MEM0_API_KEY`, `SUPABASE_SERVICE_KEY`, `GITHUB_FINE_GRAINED_PAT`, etc.

### Core Commands

From `README.md`, `.github/IMPLEMENTATION_PLAN.md`, and `AGENT_HANDOVER.md`:

```bash
# Start development server
npm run dev

# Production build
npm run build

# Generate 10k-round baseline dataset
npm run baseline

# Run entropy audit (Python-based)
npm run audit

# Monte Carlo analysis
npm run monte-carlo

# Full orchestration pipeline
npm run orchestrate
```

Recommended validation sequence (adapted from `AGENT_HANDOVER.md` and `STATUS.md`):

1. `npm run build` — ensure the TypeScript build passes (warnings acceptable).
2. `npm run dev` — confirm the UI loads and game views render without runtime errors.
3. `npm run baseline` — generate the baseline dataset.
4. `npm run audit` — run the Python entropy auditor on the baseline.

### CI/CD & Scheduled Audits

GitHub Actions workflows under `.github/workflows/` implement:

- Build/tests.
- Scheduled entropy monitoring and audits (15-minute cadence when enabled).

Secrets for these workflows must be configured in the GitHub repository settings before enabling schedules:

- SMTP / email credentials (for telemetry).
- Any required API keys (Hashes.com, Ethereum RPC, etc.).

### Live Ingestion & Verification

Once environment variables are configured:

- Use the UI to drive Mines/Keno/Crash verification flows.
- Use acquisition scripts (`scripts/liveScraper.ts`, `scripts/stake_audit.py`) to run authenticated, live data collection and verification.
- Monitor `src/telemetry/TelemetryDispatcher.ts` outputs for alerts when confidence thresholds are exceeded.

For current implementation status by phase and module, see `docs/status.md`. For architecture and module relationships, see `docs/architecture.md`.

