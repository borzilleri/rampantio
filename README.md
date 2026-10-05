# rampant.io

A static index of of random things, built with [Eleventy](https://www.11ty.dev).

## Commands

```sh
npm install
npm run dev     # local server with live reload at http://localhost:8080
npm run build   # write _site/
npm test        # Playwright smoke tests (starts the dev server itself)
npm run test:ui # same, in Playwright's UI mode
npm run clean   # remove _site/
```

## How it's put together

```
eleventy.config.js          build config (passthrough, subsite collection, pathPrefix)
src/
  _data/site.json           site-wide name, tagline, description
  _includes/base.njk        the shared document: chrome, theme toggle, asset hooks
  _includes/subsite.njk     base.njk + a subsite page header
  _includes/page-head.njk   the page-header macro both layouts call
  assets/css/base.css       baseline UI — tokens, chrome, cards, forms, tables
  assets/js/shell.js        shared behaviour (theme preference)
  index.njk                 landing page; renders the `subsites` collection
  mistria-lookup/           a subsite
  heat-tracker/             a subsite
  brine-calculator/         a subsite
tests/site.spec.js          shell, landing-page and subsite smoke tests
.github/workflows/deploy.yml
```

**Subsites are black boxes.** A subsite brings its own HTML/CSS/JS and inherits
only the shell layout and `base.css`. Its assets are copied to the output
byte-for-byte — no bundling, no rewriting.

Three rules make that safe rather than merely convenient:

- **Publishing is deny-by-default.** The passthrough glob in
  `eleventy.config.js` is an extension *allowlist* scoped to `src/[!_]*/`, so
  shell internals (`_data`, `_includes`) and stray files (`scrape.py`,
  `requirements.md`) cannot reach the output. A subsite needing a type that
  isn't listed — `.pdf`, `.webm`, `.wasm` — adds the extension to that glob.
- **Markdown is not a template format.** Notes kept beside a subsite stay
  unpublished by construction, with no ignore list to maintain.
- **`htmlTemplateEngine` is off**, so a subsite's raw HTML and inline scripts
  can never collide with Nunjucks syntax. A subsite that wants templating for
  one file sets `templateEngineOverride: njk` in its front matter; renaming to
  `.njk` also works.

## Adding a subsite

1. Create `src/<name>/index.html`.
2. Give it front matter:

   ```yaml
   ---
   layout: subsite.njk        # this alone registers it on the landing page
   title: Thing Lookup
   tagline: One line describing it.
   kicker: Game Reference     # small label above the title, optional
   source: https://example.com  # attribution link, optional; host is derived
   order: 1                   # optional; otherwise sorts alphabetically
   styles:  [thing.css]       # relative to the subsite folder
   scripts: [data.js, app.js] # loaded with defer, in order
   ---
   ```

3. Write the page body, reusing the baseline classes:

   | Class | What it is |
   |---|---|
   | `.wrap` | page gutter + max width |
   | `.section` / `.section__note` | a titled block with an optional note |
   | `.label` | the house micro-label — mono, uppercase, muted |
   | `.kicker` | a `.label` above a heading |
   | `.field` / `.toolbar` | input styling and the sticky search bar |
   | `.count` / `.count__unit` | a match count; wrap the unit word in `.count__unit` so it can be dropped on narrow screens |
   | `.table-wrap` | a table with sticky headers and horizontal scroll |
   | `.card` / `.card-grid` | the index cards |
   | `.empty` | the no-results state |
   | `.sr-only` | visually hidden, still announced |

   Put anything subsite-specific in its own stylesheet, and prefer the tokens
   (`--bg`, `--text`, `--muted`, `--line`, `--accent`, `--measure`, `--radius`)
   over literal values so the subsite follows the theme.

The subsite appears on the landing page automatically — there is no index to
maintain and no separate tag to forget. `breadcrumb` and the link text for
`source` are derived from `title` and the URL's host; override `breadcrumb`
only if a title is too long for the header.

## Theming

`base.css` defines every colour once with `light-dark()`. The toggle in the
header only changes `color-scheme` on `:root`, cycling system → light → dark
and persisting to `localStorage`. A small inline script in `base.njk` applies
the stored choice before first paint so a dark-mode reload never flashes light;
it shares the `theme` key with `assets/js/shell.js`.

Requires Chrome 123+, Safari 17.5+, Firefox 120+.

## Tests

`npm test` runs a Playwright suite against the real built output, on desktop
and mobile viewports: every page renders the shell with no console errors and
no horizontal overflow, the theme toggle cycles and actually repaints, the
landing page lists the `subsites` collection, and Mistria's search filters,
counts, empty state and `?q=` deep-links all behave. The Heat tracker's counts
stay within 0–3, persist across reloads and reset, and its boost odds and
expected value follow the cards left. The Brine calculator builds its ratio tabs
from `ratios.json`, gives salt in grams for any water unit, and remembers its
settings.

Adding a subsite doesn't require new tests, but the shell assertions will catch
one that breaks the layout.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`. Set **Settings → Pages →
Source** to **GitHub Actions** once; `actions/configure-pages` then supplies the
correct `pathPrefix` whether the site is served from a custom domain, user
pages, or a project-pages subpath.

The workflow installs with `--omit=dev` — the build only needs Eleventy, so CI
skips downloading Playwright, and the tests do not gate deploys. To get a red X
on `main` when something breaks without slowing deploys, add a parallel job
running `npx playwright install --with-deps chromium && npm test`.

## Sub-sites

| Path | What it is |
|---|---|
| [`brine-calculator/`](src/brine-calculator/) | Salt to add to water for a fermentation brine, by ratio |
| [`heat-tracker/`](src/heat-tracker/) | Tracks which 1–4 speed cards are left in a *Heat: Pedal to the Metal* deck |
| [`mistria-lookup/`](src/mistria-lookup/) | Searchable index of gifts, recipes, fish, and insects for *Fields of Mistria* |
