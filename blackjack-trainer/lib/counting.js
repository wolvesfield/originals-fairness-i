// Hi-Lo card counting trainer engine. Offline practice only — it deals from a
// simulated shoe so you can rehearse keeping the running/true count at a full
// table. It is not connected to any casino.

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function hiLoValue(rank) {
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  return -1; // 10, J, Q, K, A
}

export class Shoe {
  constructor(decks = 8) {
    this.decks = decks;
    this.reshuffle();
  }

  reshuffle() {
    this.cards = [];
    for (let d = 0; d < this.decks; d += 1) {
      for (const r of RANKS) {
        for (let s = 0; s < 4; s += 1) this.cards.push(r);
      }
    }
    // Fisher-Yates with Math.random — fine for a practice shoe (not a fairness
    // claim; this trainer makes no provably-fair guarantees).
    for (let i = this.cards.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    this.runningCount = 0;
  }

  get cardsRemaining() {
    return this.cards.length;
  }

  get decksRemaining() {
    return this.cards.length / 52;
  }

  get trueCount() {
    const dr = this.decksRemaining;
    return dr > 0 ? this.runningCount / dr : 0;
  }

  draw() {
    return this.cards.pop();
  }

  // Deals one round to `players` seats + the dealer. Player cards and the
  // dealer's UP card are exposed and counted; the dealer hole card is dealt
  // face-down and NOT counted (you can't see it).
  dealRound(players = 5) {
    if (this.cardsRemaining < players * 2 + 2) return null;

    const seats = [];
    for (let p = 0; p < players; p += 1) seats.push([this.draw(), this.draw()]);
    const dealerUp = this.draw();
    const dealerHole = this.draw(); // hidden

    const exposed = [...seats.flat(), dealerUp];
    for (const c of exposed) this.runningCount += hiLoValue(c);

    return {
      seats,
      dealerUp,
      dealerHole,
      exposed,
      runningCount: this.runningCount,
      trueCount: this.trueCount,
      cardsRemaining: this.cardsRemaining,
      decksRemaining: this.decksRemaining,
    };
  }
}
