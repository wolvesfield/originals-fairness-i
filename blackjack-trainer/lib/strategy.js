// Multi-deck blackjack basic strategy (4-8 decks).
// Pure functions, no DOM — runnable in Node for testing and in the extension.
//
// Decision depends ONLY on the player's hand and the dealer's upcard. The
// number of other players at the table does not change optimal basic strategy.

const TENS = new Set(['10', 'J', 'Q', 'K']);

export function cardValue(rank) {
  if (rank === 'A') return 11;
  if (TENS.has(rank)) return 10;
  return parseInt(rank, 10);
}

export function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c === 'A') aces += 1;
  }
  let reductions = 0;
  while (total > 21 && reductions < aces) {
    total -= 10;
    reductions += 1;
  }
  const soft = aces - reductions > 0 && total <= 21;
  return { total, soft, busted: total > 21 };
}

function between(x, lo, hi) {
  return x >= lo && x <= hi;
}

// Returns a code: H, S, D (double else hit), Ds (double else stand),
// P (split), Ph (split if DAS else hit), R (surrender else hit), Rs (surrender else stand).
function rawDecision(cards, up, rules) {
  const { h17, das } = rules;
  const isPair = cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1]);

  // --- Pairs ---
  if (isPair) {
    const pv = cardValue(cards[0]);
    if (pv === 11) return 'P'; // A,A
    if (pv === 10) return 'S';
    if (pv === 9) return [7, 10, 11].includes(up) ? 'S' : 'P';
    if (pv === 8) return 'P';
    if (pv === 7) return between(up, 2, 7) ? 'P' : 'H';
    if (pv === 6) return between(up, das ? 2 : 3, 6) ? 'P' : 'H';
    if (pv === 5) return between(up, 2, 9) ? 'D' : 'H'; // play as hard 10
    if (pv === 4) return das && between(up, 5, 6) ? 'P' : 'H';
    if (pv === 3 || pv === 2) return between(up, das ? 2 : 4, 7) ? 'P' : 'H';
  }

  const { total, soft } = handTotal(cards);

  // --- Soft totals ---
  if (soft) {
    if (total >= 20) return 'S'; // A,9
    if (total === 19) return h17 && up === 6 ? 'Ds' : 'S'; // A,8
    if (total === 18) {
      // A,7
      if (up === 2) return h17 ? 'Ds' : 'S';
      if (between(up, 3, 6)) return 'Ds';
      if (between(up, 7, 8)) return 'S';
      return 'H';
    }
    if (total === 17) return between(up, 3, 6) ? 'D' : 'H'; // A,6
    if (total === 16 || total === 15) return between(up, 4, 6) ? 'D' : 'H'; // A,5 / A,4
    if (total === 14 || total === 13) return between(up, 5, 6) ? 'D' : 'H'; // A,3 / A,2
    return 'H';
  }

  // --- Hard totals ---
  if (total >= 17) {
    if (total === 17 && h17 && up === 11) return 'Rs';
    return 'S';
  }
  if (total === 16) {
    if ([9, 10, 11].includes(up)) return 'R';
    return between(up, 2, 6) ? 'S' : 'H';
  }
  if (total === 15) {
    if (up === 10 || (h17 && up === 11)) return 'R';
    return between(up, 2, 6) ? 'S' : 'H';
  }
  if (between(total, 13, 14)) return between(up, 2, 6) ? 'S' : 'H';
  if (total === 12) return between(up, 4, 6) ? 'S' : 'H';
  if (total === 11) return up === 11 ? (h17 ? 'D' : 'H') : 'D';
  if (total === 10) return between(up, 2, 9) ? 'D' : 'H';
  if (total === 9) return between(up, 3, 6) ? 'D' : 'H';
  return 'H';
}

const LABEL = {
  H: 'Hit',
  S: 'Stand',
  D: 'Double (else hit)',
  Ds: 'Double (else stand)',
  P: 'Split',
  Ph: 'Split',
  R: 'Surrender (else hit)',
  Rs: 'Surrender (else stand)',
};

// Resolves a raw code into a concrete action given what's actually allowed
// (number of cards in hand, surrender rule).
export function basicStrategy(playerCards, dealerUpRank, rules = {}) {
  const r = {
    decks: 8,
    h17: false,
    das: true,
    surrender: false,
    ...rules,
  };
  const up = cardValue(dealerUpRank);
  const code = rawDecision(playerCards, up, r);
  const firstTwo = playerCards.length === 2;

  let resolved = code;
  if ((code === 'R' || code === 'Rs') && (!r.surrender || !firstTwo)) {
    resolved = code === 'Rs' ? 'S' : 'H';
  } else if ((code === 'D' || code === 'Ds') && !firstTwo) {
    resolved = code === 'Ds' ? 'S' : 'H';
  }

  return {
    code: resolved,
    action: LABEL[resolved],
    hand: handTotal(playerCards),
  };
}
