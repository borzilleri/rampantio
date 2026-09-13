/**
 * rampant.io — an index of self-contained sub-sites.
 *
 * Design premise: a subsite is a black box. It owns its own HTML/CSS/JS and is
 * copied to the output untouched; the only thing it inherits from the shell is
 * a layout (chrome + baseline CSS) and an entry on the landing page.
 */
export default function (eleventyConfig) {
  // Subsites own their assets — copied through verbatim, no bundling.
  //
  // Two deliberate constraints here. The leading `[!_]` skips Eleventy's
  // underscore-prefixed shell directories (`_data`, `_includes`), so internal
  // files can never be published. The extension list is an allowlist, so
  // publishing is deny-by-default: `scrape.py` and `requirements.md` stay in
  // the repo without reaching the output. A subsite needing a type that isn't
  // listed (`.pdf`, `.webm`, …) adds it here.
  eleventyConfig.addPassthroughCopy(
    "src/[!_]*/**/*.{css,js,mjs,json,csv,txt,png,jpg,jpeg,gif,svg,webp,avif,ico,woff,woff2}"
  );

  // A page that uses the subsite layout *is* a subsite — no separate tag to
  // forget. Sorts alphabetically; `order` in front matter pins one higher.
  eleventyConfig.addCollection("subsites", (api) =>
    api
      .getAll()
      .filter((page) => page.data.layout === "subsite.njk")
      .sort(
        (a, b) =>
          (a.data.order ?? 99) - (b.data.order ?? 99) ||
          a.data.title.localeCompare(b.data.title)
      )
  );

  eleventyConfig.addGlobalData("year", () => new Date().getFullYear());
  eleventyConfig.addFilter("host", (url) => new URL(url).host);
}

export const config = {
  dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
  // Subsites are raw HTML: disabling the HTML template engine means their
  // markup and inline scripts can never collide with Nunjucks syntax, while
  // front matter and layouts still apply. A subsite that wants templating for
  // one file sets `templateEngineOverride: njk` in its front matter.
  htmlTemplateEngine: false,
  // No markdown: there are no .md pages in src/, and leaving `md` out means
  // docs kept beside a subsite (requirements.md, notes.md) are unpublishable
  // by construction rather than by an ignore list that must be maintained.
  templateFormats: ["njk", "html"],
  // "" for user/org pages and custom domains; "/repo-name" for project pages.
  // The deploy workflow fills this from actions/configure-pages.
  pathPrefix: process.env.PATH_PREFIX || "/",
};
