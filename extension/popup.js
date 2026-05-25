import { verifyRound, verifyCommitment } from './lib/fairness.js';

const $ = (id) => document.getElementById(id);

const PARAM_PANELS = ['mines', 'moles', 'drill'];

function showParamsFor(game) {
  for (const g of PARAM_PANELS) {
    const panel = $(`params-${g}`);
    if (panel) panel.hidden = g !== game;
  }
}

$('game').addEventListener('change', (e) => showParamsFor(e.target.value));

function gameOptions(game) {
  switch (game) {
    case 'mines':
      return { minesCount: +$('minesCount').value, totalCells: +$('minesTotal').value };
    case 'moles':
      return { moleCount: +$('moleCount').value, totalCells: +$('molesTotal').value };
    case 'drill':
      return {
        rows: +$('drillRows').value,
        tilesPerRow: +$('drillTiles').value,
        trapsPerRow: +$('drillTraps').value,
      };
    default:
      return {};
  }
}

function gridCols(total) {
  const sqrt = Math.round(Math.sqrt(total));
  return sqrt * sqrt === total ? sqrt : 5;
}

function renderGrid(total, hits) {
  const cols = gridCols(total);
  const hitSet = new Set(hits);
  const cells = Array.from({ length: total }, (_, i) =>
    `<div class="cell ${hitSet.has(i) ? 'hit' : ''}">${i}</div>`,
  ).join('');
  return `<div class="grid" style="grid-template-columns: repeat(${cols}, 1fr)">${cells}</div>`;
}

function renderDrill(result) {
  return result.trapsByRow
    .map((traps, r) => {
      const trapSet = new Set(traps);
      const tiles = Array.from({ length: result.tilesPerRow }, (_, i) =>
        `<div class="drill-tile ${trapSet.has(i) ? 'trap' : ''}"></div>`,
      ).join('');
      return `<div class="drill-row"><span class="lbl">row ${r + 1}</span>${tiles}</div>`;
    })
    .join('');
}

function renderResult(game, nonce, result) {
  let body = '';
  if (game === 'mines') {
    body = `<div class="value">Mines at: ${result.minePositions.join(', ')}</div>${renderGrid(result.totalCells, result.minePositions)}`;
  } else if (game === 'moles') {
    body = `<div class="value">Moles at: ${result.molePositions.join(', ')}</div>${renderGrid(result.totalCells, result.molePositions)}`;
  } else if (game === 'dice') {
    body = `<div class="value">Roll: ${result.roll.toFixed(2)}</div>`;
  } else if (game === 'drill') {
    body = `<div class="value">Trap layout</div>${renderDrill(result)}`;
  }
  return `<div class="result-card"><div class="nonce">nonce ${nonce}</div>${body}</div>`;
}

async function run() {
  const btn = $('verify');
  const results = $('results');
  const commitmentEl = $('commitment');
  results.innerHTML = '';
  commitmentEl.hidden = true;
  commitmentEl.className = 'commitment';

  const game = $('game').value;
  const serverSeed = $('serverSeed').value.trim();
  const serverSeedHash = $('serverSeedHash').value.trim();
  const clientSeed = $('clientSeed').value.trim();
  const from = parseInt($('nonceFrom').value, 10);
  const to = parseInt($('nonceTo').value, 10);

  if (!serverSeed) {
    results.innerHTML = '<div class="error">Enter the revealed server seed.</div>';
    return;
  }
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    results.innerHTML = '<div class="error">Check the nonce range.</div>';
    return;
  }
  if (to - from > 500) {
    results.innerHTML = '<div class="error">Limit the range to 500 nonces at a time.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifying…';
  try {
    const commitment = await verifyCommitment(serverSeed, serverSeedHash);
    if (commitment !== null) {
      commitmentEl.hidden = false;
      commitmentEl.classList.add(commitment ? 'ok' : 'bad');
      commitmentEl.textContent = commitment
        ? '✓ Server seed matches the committed hash — the casino used the seed it promised.'
        : '✗ Server seed does NOT match the committed hash — fairness broken.';
    }

    const opts = gameOptions(game);
    const cards = [];
    for (let nonce = from; nonce <= to; nonce += 1) {
      // eslint-disable-next-line no-await-in-loop
      const result = await verifyRound(game, serverSeed, clientSeed, nonce, opts);
      cards.push(renderResult(game, nonce, result));
    }
    results.innerHTML = cards.join('');
  } catch (err) {
    results.innerHTML = `<div class="error">${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

$('verify').addEventListener('click', run);
showParamsFor($('game').value);
