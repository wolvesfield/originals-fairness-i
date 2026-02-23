## Agent & Skill Overview

This document explains the purpose of the project-specific AI agents and skills and how they relate to the rest of the documentation.

### Claude Agents (`.claude/agents`)

- **`Backend Architect & Developer.agent.md`**
  - Defines a backend-focused agent specializing in API design, database architecture, system design, and security.
  - Use when you want help designing or modifying backend services, data layers, or deployment architectures.
  - For project-specific facts (architecture, status, operations), the agent should rely on:
    - `docs/architecture.md`
    - `docs/status.md`
    - `docs/operations.md`
    - `PRD.md` (product and UX requirements)

- **`Data Analyst & Quantitative Factor Research Engineer.agent.md`**
  - Defines a data and quantitative research agent with expertise in data pipelines, factor research, and automated data acquisition.
  - Use when you want help with entropy analysis, statistical validation, factor research, or complex data workflows.
  - For canonical project context, this agent should also reference:
    - `docs/architecture.md`
    - `docs/status.md`
    - `docs/operations.md`
    - `PRD.md`

### Cursor/Codex Skills (`.agents/skills`)

- **`data-analysis/SKILL.md`**
  - Despite the name, this skill currently defines an **ethical hacking and cybersecurity planning role** focused on:
    - Translating task lists into secure, obfuscated execution plans.
    - Prioritizing tasks by risk and dependency.
    - Highlighting security considerations and mitigation strategies.
  - It also contains a historical snapshot of project status and remaining work. Going forward, treat that embedded status as **legacy** and prefer `docs/status.md` for up-to-date information.

- **`hacking_specialist/SKILL.md`**
  - Defines a “role mode” system prompt for a cryptography-oriented architecture/prompt strategy.
  - Focuses on:
    - Correct cryptographic flow for Mines/Keno/Crash (HMAC, seed/nonce relationships).
    - Grid scalability and correctness for different board sizes.
    - Seed resolution, hash-chain traversal, and UI integration patterns.
  - Use this when you need deep, cryptographic refactors or verification of crypto/game-mapping logic.

### How to Use These with the Docs

- Treat **this `docs/agents/overview.md`** as your entrypoint to the agent/skill ecosystem.
- Treat **`docs/architecture.md`**, **`docs/status.md`**, **`docs/operations.md`**, and **`PRD.md`** as the canonical sources of truth for the system.
- When updating agent or skill prompts, prefer linking to these docs rather than re-embedding long status reports or architectural descriptions.

