---
name: debug-tests-autofix
description: Multi-step workflow to debug failing tests (or lint/build), identify root cause, and apply fixes with retries. Use when tests fail, lint fails, build fails, or the user asks to fix failing checks or make the agent self-healing for CI.
---

# Debug Failing Tests and Auto-Fix

Use this workflow when any of these fail: **tests** (`npm test` or project test command), **lint** (`npm run lint`), or **build** (`npm run build`). Follow the steps in order; do not stop after one attempt unless the user asks.

## 1. Capture failure output

- Run the failing command via the **Shell** tool (e.g. `npm run lint`, `npm run build`, or `npm test`).
- Do not truncate or summarize the raw stderr/stdout. Keep the full output in context so stack traces, file:line, and rule names are visible.

## 2. Classify the failure

| Failure type | What to look for | Primary fix strategy |
|--------------|-------------------|------------------------|
| **Lint** | ESLint rule id, file path, line number | Fix the reported pattern in that file; run `ReadLints` on that path after edit. |
| **TypeScript/build** | `tsc` or Vite errors; file path and line | Fix types or imports; ensure `tsc -b --noCheck` and `vite build` both pass. |
| **Test** | Jest (or other runner) test name, file, assertion message | Fix the code under test or the test expectation; re-run the test file or full suite. |
| **Runtime (scripts)** | Node/tsx or Python traceback | Fix the reported file and line; re-run the same script. |

If the output points to a specific file and line, open that file and inspect the surrounding code before changing anything.

## 3. Apply one focused fix

- Change **one** logical thing (one rule violation, one type error, one assertion, one missing import).
- Prefer minimal edits. Do not refactor unrelated code unless it is required to fix the failure.
- After editing, run **ReadLints** on the modified file(s) to catch new diagnostics.

## 4. Re-run the same command

- Run the **exact same** command again (e.g. `npm run lint` or `npm run build` or `npm test`).
- If it passes, proceed to step 5. If it fails, use the **new** failure output and go back to step 2 (re-classify and fix again).

## 5. Retry budget and escalation

- **Retry budget**: Attempt at least **2** full fix cycles (fix → re-run). After 2 attempts, if failures persist:
  - Summarize what was tried and the current error.
  - Propose the next concrete fix or state that the issue is blocked (e.g. external dependency, env, or unclear requirement).
- Do not report "fixed" until the command has been re-run and succeeded.

## Checklist (copy and tick as you go)

```
- [ ] Ran failing command and captured full output
- [ ] Classified failure (lint / build / test / runtime)
- [ ] Applied one focused fix
- [ ] Re-ran same command
- [ ] If still failing: second fix cycle, then re-ran
- [ ] Confirmed pass or escalated with summary
```

## Commands reference (this repo)

- Lint: `npm run lint`
- Build: `npm run build`
- Tests: use project test command when available (e.g. `npm test`); otherwise N/A.
- Python scripts: `pip install -r requirements.txt` then e.g. `python scripts/entropy_auditor.py` as in CI.

## Optional: narrow re-runs

To save time after a single-file fix:

- **Lint**: `npx eslint <path-to-file>`
- **Build**: still run `npm run build` (full build required for CI).
- **Tests**: if the runner supports it, run only the affected test file; otherwise run the full suite to confirm nothing else broke.
