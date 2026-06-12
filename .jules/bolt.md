## 2025-03-08 - Bounded HMAC Cache
**Learning:** When caching instances (like HMAC object) for hot paths that iterate extensively over unknown numbers of server seeds (like background workers), using an unbounded `Map` creates a memory leak over time.
**Action:** Use a bounded cache (like LRU) or a single-value cache (e.g. `let lastSeed`, `let lastHmac`) for loops where seeds are mostly static but occasionally rotate.
