/* Renders the lookup tables from DATA (data.js) and filters them in place. */
(function () {
  const results = document.getElementById('results');
  const empty = document.getElementById('empty');
  const countEl = document.getElementById('count');
  const q = document.getElementById('q');

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const key = (s) => esc(s).toLowerCase();

  const items = (list) =>
    '<ul>' + list.map((i) => `<li data-k="${key(i)}">${esc(i)}</li>`).join('') + '</ul>';

  const card = (name, rows) =>
    `<div class="npc" data-name="${key(name)}">` +
    (name ? `<h3>${esc(name)}</h3>` : '') +
    rows
      .filter((r) => r[1]?.length)
      .map((r) => `<div class="row"><b class="label">${r[0]}</b>${items(r[1])}</div>`)
      .join('') +
    '</div>';

  const table = (cols, rows) =>
    '<div class="table-wrap"><table><thead><tr>' +
    cols.map((c) => `<th>${c[0]}</th>`).join('') +
    '</tr></thead><tbody>' +
    rows
      .map(
        (r) =>
          `<tr data-k="${key(r.name)}">` +
          cols.map((c) => `<td>${esc(r[c[1]])}</td>`).join('') +
          '</tr>'
      )
      .join('') +
    '</tbody></table></div>';

  const section = (heading, body, note) =>
    `<section class="section"><h2>${heading}</h2>` +
    (note ? `<p class="section__note">${note}</p>` : '') +
    body +
    '</section>';

  results.innerHTML =
    section(
      'Universal Gifts',
      card('', [['Lovable', DATA.universal.lovable], ['Likeable', DATA.universal.likeable]]),
      'No item is liked or loved by everyone. Items carrying the Lovable or Likeable infusion are the exception.'
    ) +
    section(
      'Gifts by NPC',
      Object.entries(DATA.gifts)
        .map(([npc, g]) => card(npc, [['Loves', g.love], ['Likes', g.like]]))
        .join('')
    ) +
    section('Recipes', table([['Recipe', 'name'], ['Type', 'type'], ['Where to get', 'source']], DATA.recipes)) +
    section(
      'Fish',
      table(
        [['Fish', 'name'], ['Location', 'location'], ['Season', 'season'], ['Weather', 'weather'],
         ['Method', 'method'], ['Size', 'size'], ['Rarity', 'rarity']],
        DATA.fish
      )
    ) +
    section(
      'Insects',
      table(
        [['Insect', 'name'], ['Location', 'location'], ['Season', 'season'], ['Weather', 'weather'],
         ['Time', 'time'], ['Condition', 'condition'], ['Rarity', 'rarity']],
        DATA.bugs
      )
    );

  const LEAF = '.row li, tbody tr';
  const SHOWN = '.row li:not([hidden]), tbody tr:not([hidden])';
  const TOTAL = results.querySelectorAll(LEAF).length;

  function filter() {
    const t = q.value.trim().toLowerCase();

    // Matching an NPC's name reveals that NPC's whole list, so the name is
    // tested once per card rather than once per gift.
    for (const npc of results.querySelectorAll('.npc')) {
      const nameHit = !t || npc.dataset.name.includes(t);
      for (const li of npc.querySelectorAll('li')) {
        li.hidden = !(nameHit || li.dataset.k.includes(t));
      }
    }
    for (const tr of results.querySelectorAll('tbody tr')) {
      tr.hidden = !(!t || tr.dataset.k.includes(t));
    }
    // Containers follow their contents; read the rollup back off the DOM
    // instead of threading hit counts through the loops above.
    for (const box of results.querySelectorAll('.row, .npc, .section')) {
      box.hidden = !box.querySelector(SHOWN);
    }

    const shown = results.querySelectorAll(SHOWN).length;
    empty.hidden = shown > 0;
    countEl.innerHTML = t
      ? `${shown.toLocaleString()} of ${TOTAL.toLocaleString()}`
      : `${TOTAL.toLocaleString()} <span class="count__unit">entries</span>`;
  }

  /* Searches are shareable: ?q=… restores the filter. Only the URL write is
     debounced — filtering itself is coalesced into one layout per frame. */
  let urlTimer;
  const syncUrl = () => {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const u = new URL(location.href);
      if (q.value.trim()) u.searchParams.set('q', q.value.trim());
      else u.searchParams.delete('q');
      history.replaceState(null, '', u);
    }, 300);
  };

  q.value = new URL(location.href).searchParams.get('q') || '';
  filter();
  q.addEventListener('input', () => {
    filter();
    syncUrl();
  });

  /* `f` jumps to the search box from anywhere on the page — but never out from
     under a field that is already taking the keystroke. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'f' || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement;
    if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName)) return;
    e.preventDefault();
    q.focus();
    q.select();
  });
})();
