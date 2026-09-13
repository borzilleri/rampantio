/* Shared chrome behaviour. The pre-paint half of the theme toggle is inline in
   _includes/base.njk — the 'theme' key and light/dark values are shared with
   it. Preference cycles system -> light -> dark. */
(function () {
  const KEY = 'theme';
  const ORDER = ['system', 'light', 'dark'];
  const LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' };
  const root = document.documentElement;
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;

  /* Re-read on each click rather than caching, so a change made in another
     tab is picked up instead of being clobbered. */
  const read = () => {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  };

  const label = (mode) => {
    btn.textContent = LABEL[mode];
    btn.setAttribute('aria-label', `Colour theme: ${LABEL[mode]}. Click to change.`);
  };

  const apply = (mode) => {
    if (mode === 'system') delete root.dataset.theme;
    else root.dataset.theme = mode;
    label(mode);
    try {
      if (mode === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch {}
  };

  // The inline script already applied the stored theme; only the label is new.
  label(read());
  btn.addEventListener('click', () => apply(ORDER[(ORDER.indexOf(read()) + 1) % ORDER.length]));
})();
