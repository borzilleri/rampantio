/* Counts played speed cards (1–4, three copies each) and keeps them across
   reloads in localStorage. A boost draws until it hits one of these, so its
   odds are just each number's share of the speed cards still in the deck. */
(function () {
  const KEY = 'heat-tracker';
  const NUMBERS = [1, 2, 3, 4];
  const COPIES = 3;
  const ALL = NUMBERS.length * COPIES;
  const fresh = () => NUMBERS.map(() => 0);

  const list = document.getElementById('cards');
  const total = document.getElementById('total');
  const ev = document.getElementById('ev');
  const reset = document.getElementById('reset');

  // Played count per number. Anything unreadable or out of range starts fresh.
  const load = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(v) && v.length === NUMBERS.length &&
          v.every((n) => Number.isInteger(n) && n >= 0 && n <= COPIES)) return v;
    } catch {}
    return fresh();
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(played)); } catch {}
  };

  let played = load();

  list.innerHTML = NUMBERS.map((n, i) =>
    `<li class="heat__row" data-i="${i}">` +
      `<span class="heat__num" aria-hidden="true">${n}</span>` +
      `<span class="heat__left">` +
        `<span class="heat__line">` +
          `<span class="heat__pips" aria-hidden="true">${'<i></i>'.repeat(COPIES)}</span>` +
          `<span class="heat__odds" data-odds></span>` +
        `</span>` +
        `<span class="label" data-left></span>` +
      `</span>` +
      `<button type="button" data-undo aria-label="Put back a ${n}">&minus;</button>` +
      `<button type="button" data-play aria-label="Play a ${n}">+</button>` +
    `</li>`
  ).join('');

  function render() {
    const lefts = played.map((p) => COPIES - p);
    const remaining = lefts.reduce((a, b) => a + b, 0);
    const sum = lefts.reduce((s, left, i) => s + NUMBERS[i] * left, 0);
    // An empty deck gets reshuffled before the next boost, so there's nothing to show.
    const orDash = (s) => (remaining ? s : '—');

    for (const row of list.children) {
      const left = lefts[row.dataset.i];
      row.querySelector('[data-left]').textContent = `${left} of ${COPIES} left`;
      row.querySelector('[data-odds]').textContent = orDash(`${Math.round((left / remaining) * 100)}%`);
      row.querySelectorAll('.heat__pips i').forEach((pip, j) => pip.toggleAttribute('data-played', j >= left));
      row.querySelector('[data-undo]').disabled = left === COPIES;
      row.querySelector('[data-play]').disabled = left === 0;
      row.toggleAttribute('data-empty', left === 0);
    }
    ev.textContent = orDash((sum / remaining).toFixed(2));
    total.textContent = `${remaining} of ${ALL} left`;
  }

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    // render() disables each button at its bound, so no clamp is needed here.
    played[btn.closest('.heat__row').dataset.i] += 'play' in btn.dataset ? 1 : -1;
    save();
    render();
  });

  /* Reset sits next to a stream of rapid taps, so it takes two: the first arms
     it, the second — within a few seconds — clears. No blocking confirm(). */
  let disarm;
  reset.addEventListener('click', () => {
    if (!reset.hasAttribute('data-armed')) {
      reset.setAttribute('data-armed', '');
      reset.textContent = 'Tap to confirm';
      disarm = setTimeout(restore, 3000);
      return;
    }
    clearTimeout(disarm);
    restore();
    played = fresh();
    save();
    render();
  });
  function restore() {
    reset.removeAttribute('data-armed');
    reset.textContent = 'Reset';
  }

  render();
})();
