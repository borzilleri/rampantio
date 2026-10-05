/* Salt for a fermentation brine, in grams, as a percentage of the water's
   weight. The preset ratios come from ratios.json, with Manual always last.
   Settings persist in localStorage. */
(function () {
  const KEY = 'brine-calculator';
  // Grams of water per unit.
  const WATER = { gal: 3785.41, qt: 946.353, pt: 473.176, cup: 236.588, ml: 1, g: 1 };

  const form = document.getElementById('brine');
  const ratios = document.getElementById('ratios');
  const pctRow = document.getElementById('pct-row');
  const result = document.getElementById('result');
  const detail = document.getElementById('detail');

  const grams = (g) => `${g < 10 ? g.toFixed(1) : Math.round(g).toLocaleString()} g`;

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      for (const [name, value] of Object.entries(v || {})) {
        const el = form.elements[name];
        // A radio group's value only takes if one of its options matches.
        if (el && typeof value === 'string') el.value = value;
      }
    } catch {}
  }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(new FormData(form)))); } catch {}
  };

  function render() {
    const f = form.elements;
    const manual = f.ratio.value === 'manual';
    pctRow.hidden = !manual;

    const pct = parseFloat(manual ? f.pct.value : f.ratio.value);
    const water = parseFloat(f.water.value) * WATER[f.unit.value];
    if (!(pct > 0) || !(water > 0)) {
      result.textContent = '—';
      detail.textContent = 'Enter an amount of water and a salt percentage.';
      return;
    }

    const salt = water * pct / 100;
    result.textContent = grams(salt);
    detail.textContent = `${pct}% of ${grams(water)} of water`;
  }

  form.addEventListener('submit', (e) => e.preventDefault());

  const tab = (value, name, sub) =>
    `<label><input type="radio" name="ratio" value="${value}">` +
    `<span>${name}<small class="label">${sub}</small></span></label>`;

  // Tabs have to exist before saved settings can select one.
  fetch('ratios.json')
    .then((r) => r.json())
    .then((presets) => {
      ratios.insertAdjacentHTML('beforeend',
        presets.map((p) => tab(p.percent, p.name, `${p.percent}%`)).join('') +
        tab('manual', 'Manual', 'Custom'));
      form.elements.ratio[0].checked = true;
      load();
      render();
      form.addEventListener('input', () => { save(); render(); });
    })
    .catch(() => { detail.textContent = "Couldn't load the brine ratios."; });
})();
