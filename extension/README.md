# Provably-Fair Verifier (Chrome Extension)

A self-contained Manifest V3 extension that **recomputes and verifies** the
outcomes of provably-fair rounds for **Mines, Dice, Moles, and Drill**.

## What it does

Given a **revealed** server seed, the client seed, and a nonce (or nonce
range), it reproduces exactly what the game outcome was and lets you confirm
the casino didn't cheat:

- Recomputes mine/mole positions, dice rolls, and drill trap layouts from
  `HMAC-SHA256(serverSeed, clientSeed:nonce:round)` using the canonical
  Stake-style byte-stream algorithm.
- Optionally checks the **commitment**: `SHA-256(serverSeed)` must equal the
  hash the casino published *before* you played. If it doesn't, fairness is
  broken.
- Batch-verifies a whole nonce range at once.

## What it does NOT do

- It does **not** predict, estimate, or "assume" future rounds. That is not a
  policy choice — it is impossible. Each outcome is HMAC-SHA256 output, which is
  computationally indistinguishable from random. Past results give zero
  information about the next one, and the server seed needed to compute a future
  outcome isn't revealed until *after* those rounds settle.
- It requests **no permissions**, reads no pages, and sends no network
  requests. It's an offline calculator.

## Accuracy notes

- **Mines** and **Dice** follow Stake's published provably-fair algorithm.
- **Moles** and **Drill** are modeled as configurable grid/row games. Confirm
  the parameters (grid size, tiles/traps per row) against your platform's own
  fairness documentation before relying on the recomputed layout.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Open the popup, paste a revealed seed, set the game and nonce, and verify.

## How verification works

```
outcome = f( HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${round}`) )
```

The HMAC output is consumed 4 bytes at a time, each group mapped to a float in
`[0, 1)`, and those floats drive the game logic (Fisher-Yates-style removal for
grids, scaling for dice). Because the function is deterministic, anyone with the
revealed seed gets the identical result — that's the whole point of "provably
fair."
