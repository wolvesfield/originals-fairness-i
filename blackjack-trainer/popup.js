import { basicStrategy } from './lib/strategy.js';
import { Shoe, hiLoValue } from './lib/counting.js';

const $ = (id) => document.getElementById(id);
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// --- Tabs ---
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    $('tab-strategy').hidden = tab !== 'strategy';
    $('tab-trainer').hidden = tab !== 'trainer';
  });
});

function readRules() {
  return {
    decks: parseInt($('decks').value, 10),
    h17: $('soft17').value === 'h17',
    das: $('das').checked,
    surrender: $('surrender').checked,
  };
}

// --- Strategy tab ---
let playerCards = [];
let dealerCard = null;

function buildPad(padId, onPick) {
  const pad = $(padId);
  pad.innerHTML = '';
  for (const r of RANKS) {
    const b = document.createElement('button');
    b.textContent = r;
    b.addEventListener('click', () => onPick(r));
    pad.appendChild(b);
  }
}

function renderChosen() {
  $('playerCards').innerHTML = playerCards.map((c) => `<span class="c">${c}</span>`).join('');
  $('dealerCard').innerHTML = dealerCard ? `<span class="c">${dealerCard}</span>` : '';
}

const ADVICE_CLASS = {
  Hit: 'hit',
  Stand: 'stand',
  'Double (else hit)': 'double',
  'Double (else stand)': 'double',
  Split: 'split',
  'Surrender (else hit)': 'surrender',
  'Surrender (else stand)': 'surrender',
};

function updateAdvice() {
  const el = $('advice');
  el.className = 'advice';
  if (playerCards.length < 2 || !dealerCard) {
    el.innerHTML = '<div class="why">Pick at least two of your cards and the dealer\'s upcard.</div>';
    return;
  }
  const res = basicStrategy(playerCards, dealerCard, readRules());
  const handDesc = res.hand.busted
    ? 'busted'
    : `${res.hand.soft ? 'soft ' : ''}${res.hand.total}`;
  el.classList.add(ADVICE_CLASS[res.action] || '');
  el.innerHTML = `<div class="act">${res.action}</div><div class="why">Your hand: ${handDesc} vs dealer ${dealerCard}</div>`;
}

buildPad('playerPad', (r) => {
  if (playerCards.length < 6) playerCards.push(r);
  renderChosen();
  updateAdvice();
});
buildPad('dealerPad', (r) => {
  dealerCard = r;
  renderChosen();
  updateAdvice();
});
$('clearPlayer').addEventListener('click', () => {
  playerCards = [];
  renderChosen();
  updateAdvice();
});
['decks', 'soft17', 'das', 'surrender'].forEach((id) =>
  $(id).addEventListener('change', updateAdvice),
);
updateAdvice();

// --- Counting trainer tab ---
let shoe = null;
let correct = 0;
let attempts = 0;

function pipClass(rank) {
  const v = hiLoValue(rank);
  return v > 0 ? 'lo' : v < 0 ? 'hi' : 'neu';
}

function ensureShoe() {
  const decks = parseInt($('decks').value, 10);
  if (!shoe || shoe.decks !== decks) {
    shoe = new Shoe(decks);
    correct = 0;
    attempts = 0;
  }
}

function renderStats() {
  $('cardsLeft').textContent = shoe ? shoe.cardsRemaining : '—';
  $('decksLeft').textContent = shoe ? shoe.decksRemaining.toFixed(1) : '—';
  $('accuracy').textContent = attempts ? `${Math.round((correct / attempts) * 100)}%` : '—';
}

function renderRound(round) {
  const seatRows = round.seats
    .map((cards, i) => {
      const pips = cards
        .map((c) => `<span class="pip ${pipClass(c)}">${c}</span>`)
        .join('');
      return `<div class="seat"><span class="who">Player ${i + 1}</span>${pips}</div>`;
    })
    .join('');
  const dealerRow = `<div class="seat"><span class="who">Dealer</span><span class="pip ${pipClass(round.dealerUp)}">${round.dealerUp}</span><span class="pip hole">?</span></div>`;
  $('table').innerHTML = seatRows + dealerRow;
}

let lastRound = null;

$('deal').addEventListener('click', () => {
  ensureShoe();
  const players = Math.max(1, Math.min(7, parseInt($('players').value, 10) || 5));
  const round = shoe.dealRound(players);
  if (!round) {
    $('countResult').className = 'count-result';
    $('countResult').textContent = 'Shoe is low — reshuffle to continue.';
    renderStats();
    return;
  }
  lastRound = round;
  renderRound(round);
  $('guessRC').value = '';
  $('countResult').className = 'count-result';
  $('countResult').textContent = '';
  renderStats();
});

$('reshuffle').addEventListener('click', () => {
  ensureShoe();
  shoe.reshuffle();
  correct = 0;
  attempts = 0;
  lastRound = null;
  $('table').innerHTML = '';
  $('countResult').className = 'count-result';
  $('countResult').textContent = 'Fresh shoe — running count reset to 0.';
  renderStats();
});

$('checkCount').addEventListener('click', () => {
  if (!lastRound) return;
  const guess = parseInt($('guessRC').value, 10);
  if (Number.isNaN(guess)) return;
  attempts += 1;
  const el = $('countResult');
  if (guess === lastRound.runningCount) {
    correct += 1;
    el.className = 'count-result ok';
    el.textContent = `Correct. Running count ${lastRound.runningCount}, true count ${lastRound.trueCount.toFixed(2)}.`;
  } else {
    el.className = 'count-result bad';
    el.textContent = `Off. Running count is ${lastRound.runningCount} (true ${lastRound.trueCount.toFixed(2)}).`;
  }
  renderStats();
});

renderStats();
