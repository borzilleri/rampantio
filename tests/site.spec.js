import { test as base, expect } from "@playwright/test";

/** Entry count rendered from data.js; regenerating it via scrape.py moves this. */
const TOTAL = "1,974";
const PAGES = ["/", "/mistria-lookup/", "/heat-tracker/"];

/**
 * Every test fails if the page logged an error or failed to load a resource —
 * opting in per-test would leave the JS-heaviest cases unguarded.
 */
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("requestfailed", (r) => errors.push(`${r.url()} — ${r.failure()?.errorText}`));
    await use(page);
    expect(errors, "page logged errors").toEqual([]);
  },
});

test.describe("shared shell", () => {
  for (const path of PAGES) {
    test(`${path} renders the chrome and stays within the viewport`, async ({ page }) => {
      await page.goto(path);

      await expect(page.locator(".wordmark")).toHaveText("rampant.io");
      await expect(page.locator("[data-theme-toggle]")).toBeVisible();
      await expect(page.locator(".site-footer")).toBeVisible();
      // base.css actually applied, not just linked.
      await expect(page.locator("body")).toHaveCSS("margin", "0px");

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
    });
  }

  test("theme toggle cycles, repaints and survives a reload", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator("[data-theme-toggle]");
    const html = page.locator("html");
    const bg = () => page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);

    await expect(btn).toHaveText("Auto");
    await btn.click();
    await expect(btn).toHaveText("Light");
    await expect(html).toHaveAttribute("data-theme", "light");
    const light = await bg();

    await btn.click();
    await expect(btn).toHaveText("Dark");
    const dark = await bg();
    // light-dark() resolves off color-scheme; prove it actually repainted.
    expect(dark, "dark theme must repaint the background").not.toBe(light);

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(btn).toHaveText("Dark");
    expect(await bg()).toBe(dark);

    await btn.click();
    await expect(btn).toHaveText("Auto");
    await expect(html).not.toHaveAttribute("data-theme", /.*/);
  });
});

test.describe("landing page", () => {
  test("lists subsites from the collection and links to them", async ({ page }) => {
    await page.goto("/");
    const card = page.locator(".card", { hasText: "Mistria Lookup" });
    await expect(card).toBeVisible();
    await expect(card.locator(".kicker")).toHaveText("Game Reference");

    await card.locator("h2 a").click();
    await expect(page).toHaveURL(/\/mistria-lookup\/$/);
    await expect(page.locator("h1")).toHaveText("Mistria Lookup");
    // Breadcrumb falls back to the page title — no separate front-matter key.
    await expect(page.locator(".crumb")).toContainText("Mistria Lookup");
  });
});

test.describe("mistria lookup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/mistria-lookup/");
  });

  test("renders every section from data.js", async ({ page }) => {
    for (const h of ["Universal Gifts", "Gifts by NPC", "Recipes", "Fish", "Insects"]) {
      await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    }
    await expect(page.locator("#count")).toHaveText(`${TOTAL} entries`);
    await expect(page.locator("#empty")).toBeHidden();
  });

  test("search filters entries and reports the match count", async ({ page }) => {
    const before = await page.locator("tbody tr:visible").count();

    await page.locator("#q").fill("trout");
    await expect(page.locator("#count")).toHaveText(new RegExp(`^\\d+ of ${TOTAL}$`));

    const after = await page.locator("tbody tr:visible").count();
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);

    // Every visible row genuinely matches.
    for (const row of await page.locator("tbody tr:visible").all()) {
      expect((await row.locator("td").first().innerText()).toLowerCase()).toContain("trout");
    }
  });

  test("matching an NPC name reveals that NPC's whole gift list", async ({ page }) => {
    await page.locator("#q").fill("adeline");

    const npc = page.locator('.npc[data-name="adeline"]');
    await expect(npc).toBeVisible();
    await expect(npc.locator("li:visible")).not.toHaveCount(0);
    await expect(page.locator('.npc[data-name="march"]')).toBeHidden();
  });

  test("a search with no results shows the empty state", async ({ page }) => {
    await page.locator("#q").fill("zzzzzznope");
    await expect(page.locator("#empty")).toBeVisible();
    await expect(page.locator("#count")).toHaveText(`0 of ${TOTAL}`);
  });

  test("f focuses the search box from elsewhere on the page, but never steals a keystroke", async ({ page }) => {
    await page.locator("#q").fill("salmon");
    await page.locator(".mode").focus();

    await page.keyboard.press("f");
    await expect(page.locator("#q")).toBeFocused();
    // The shortcut selects, so the next keystroke replaces the old search.
    await page.keyboard.type("carp");
    await expect(page.locator("#q")).toHaveValue("carp");

    // Already in the field, f is just a letter.
    await page.keyboard.press("f");
    await expect(page.locator("#q")).toHaveValue("carpf");
  });

  // Table rows and NPC blocks band the same way; both count visible siblings.
  for (const [what, sel, kids] of [
    ["table rows", "#results tbody", "tr"],
    ["NPC blocks", "#results .section", ".npc"],
  ]) {
    test(`${what} band over the visible entries, not the hidden ones`, async ({ page }) => {
      const tints = () =>
        page.$$eval(
          sel,
          (groups, kids) =>
            groups
              .map((g) =>
                [...g.querySelectorAll(kids)]
                  .filter((el) => !el.hidden)
                  .map((el) => getComputedStyle(el).backgroundColor)
              )
              .filter((band) => band.length > 1),
          kids
        );

      // Filtering must renumber the bands, not leave a gap where an entry was.
      for (const q of ["", "a"]) {
        await page.locator("#q").fill(q);
        const groups = await tints();
        expect(groups.length).toBeGreaterThan(0);
        for (const band of groups) {
          const [plain, tinted] = band;
          expect(tinted).not.toBe(plain);
          expect(band).toEqual(band.map((_, i) => (i % 2 ? tinted : plain)));
        }
      }
    });
  }

  test("?q= deep-links a search and typing updates the URL", async ({ page }) => {
    await page.goto("/mistria-lookup/?q=salmon");
    await expect(page.locator("#q")).toHaveValue("salmon");
    await expect(page.locator("#count")).toHaveText(new RegExp(`^\\d+ of ${TOTAL}$`));

    await page.locator("#q").fill("carp");
    await expect(page).toHaveURL(/\?q=carp$/);
  });
});

test.describe("heat tracker", () => {
  const row = (page, n) => page.locator(".heat__row").nth(n - 1);
  const playAll = async (page, n) => {
    const play = row(page, n).getByRole("button", { name: `Play a ${n}` });
    for (let i = 0; i < 3; i++) await play.click();
  };

  test.beforeEach(async ({ page }) => {
    await page.goto("/heat-tracker/");
  });

  test("starts with a full deck", async ({ page }) => {
    await expect(page.locator(".heat__row")).toHaveCount(4);
    await expect(page.locator("#total")).toHaveText("12 of 12 left");
    await expect(row(page, 1).locator("[data-left]")).toHaveText("3 of 3 left");
    await expect(row(page, 1).getByRole("button", { name: "Put back a 1" })).toBeDisabled();
  });

  test("boost expected value and odds follow the cards left", async ({ page }) => {
    const odds = page.locator("[data-odds]");
    await expect(page.locator("#ev")).toHaveText("2.50");
    await expect(odds).toHaveText(["25%", "25%", "25%", "25%"]);

    // With every 2 gone, a boost is 1, 3 or 4 at a third each: (1 + 3 + 4) / 3.
    await playAll(page, 2);
    await expect(page.locator("#ev")).toHaveText("2.67");
    await expect(odds).toHaveText(["33%", "0%", "33%", "33%"]);

    // An empty deck reshuffles before the next boost, so there's nothing to show.
    for (const n of [1, 3, 4]) await playAll(page, n);
    await expect(page.locator("#ev")).toHaveText("—");
    await expect(odds).toHaveText(["—", "—", "—", "—"]);
  });

  test("play and put back stay within 0–3 copies", async ({ page }) => {
    const r = row(page, 2);
    const play = r.getByRole("button", { name: "Play a 2" });
    await playAll(page, 2);

    await expect(r.locator("[data-left]")).toHaveText("0 of 3 left");
    await expect(play).toBeDisabled();
    await expect(r.locator(".heat__pips i[data-played]")).toHaveCount(3);
    await expect(page.locator("#total")).toHaveText("9 of 12 left");

    await r.getByRole("button", { name: "Put back a 2" }).click();
    await expect(r.locator("[data-left]")).toHaveText("1 of 3 left");
    await expect(play).toBeEnabled();
  });

  test("counts survive a reload", async ({ page }) => {
    await row(page, 4).getByRole("button", { name: "Play a 4" }).click();
    await page.reload();
    await expect(row(page, 4).locator("[data-left]")).toHaveText("2 of 3 left");
    await expect(page.locator("#total")).toHaveText("11 of 12 left");
  });

  test("reset takes a confirming second tap", async ({ page }) => {
    await row(page, 1).getByRole("button", { name: "Play a 1" }).click();
    const reset = page.locator("#reset");

    await reset.click();
    await expect(reset).toHaveText("Tap to confirm");
    await expect(page.locator("#total")).toHaveText("11 of 12 left");

    await reset.click();
    await expect(reset).toHaveText("Reset");
    await expect(page.locator("#total")).toHaveText("12 of 12 left");
    await page.reload();
    await expect(page.locator("#total")).toHaveText("12 of 12 left");
  });
});
