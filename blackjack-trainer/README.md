# Blackjack Strategy & Counting Trainer (Chrome Extension)

A self-contained Manifest V3 extension with two offline tools:

1. **Basic Strategy Advisor** — pick your cards and the dealer's upcard, set the
   table rules, and it shows the mathematically optimal play (hit / stand /
   double / split / surrender) for multi-deck blackjack, with your hand total.
2. **Counting Trainer** — deals a simulated shoe to a full table (default **5
   players** + dealer), exposes every player card and the dealer upcard, and
   lets you practice keeping the **Hi-Lo running count**. It then shows the
   correct running count, the **true count** (running ÷ decks remaining), and
   tracks your accuracy.

## Why the player count matters here

Your *basic-strategy* decision depends only on your hand vs. the dealer upcard —
the number of other players does **not** change it. Where 5 players matters is
**counting**: each extra seat means more cards leave the shoe per round, so the
count moves faster. The trainer deals all 5 hands so you rehearse counting a
realistic, full table.

## Honest limits

- This is a **practice and reference** tool. It is **not connected to any
  casino**, reads no live feed, and requests no permissions.
- Basic strategy drives the house edge down to roughly half a percent — it does
  **not** flip blackjack into a winning game.
- Using software assistance during real-money online play violates casino terms
  of service, and using a *device* to count cards is illegal in some
  jurisdictions. This trainer is for learning the math away from the table.

## Rules supported

- 1 / 2 / 4 / 6 / 8 decks
- Dealer stands or hits on soft 17 (S17 / H17)
- Double after split on/off
- Late surrender on/off

The strategy table targets multi-deck (4–8) play; the S17/H17, DAS, and
surrender toggles adjust the borderline decisions accordingly.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `blackjack-trainer/` folder.

## Tested

- `lib/strategy.js`: 26 reference cases (hard/soft/pairs, S17 vs H17, DAS, surrender).
- `lib/counting.js`: balanced-shoe sum = 0, 5-player round deals/counts the right
  cards, true-count math.
