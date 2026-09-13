#!/usr/bin/env python3
"""Pull gift, recipe, fish and insect data from fieldsofmistria.wiki.gg and write data.js."""
import html
import json
import re
import urllib.parse
import urllib.request

API = "https://fieldsofmistria.wiki.gg/api.php"
UA = "mistria-lookup/0.1 (personal project)"
BR = r'<br\s*/?>'


def cargo(tables, fields, where=None):
    rows, offset = [], 0
    while True:
        params = {"action": "cargoquery", "format": "json", "tables": tables,
                  "fields": fields, "limit": 500, "offset": offset}
        if where:
            params["where"] = where
        req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
        with urllib.request.urlopen(req) as r:
            body = json.load(r)
        if "error" in body:
            raise SystemExit(f"API error for {tables}: {body['error']}")
        page = [x["title"] for x in body["cargoquery"]]
        rows += page
        if len(page) < 500:
            return rows
        offset += 500


def clean(s):
    """Wikitext/HTML fragment -> plain text."""
    s = s or ""
    s = re.sub(r'<span[^>]*display:\s*none[^>]*>.*?</span>', '', s, flags=re.S)
    s = re.sub(r'\[\[(?:File|Category):[^\]]*\]\]', '', s)
    s = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'\[\[([^\]]*)\]\]', r'\1', s)
    s = re.sub(BR + r'|\n', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s).replace(' ', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def clean_list(s, sep=", "):
    """Like clean(), but <br> separates distinct values (unless it precedes a parenthetical)."""
    parts = [clean(p) for p in re.split(BR + r'(?!\s*\()', s or "")]
    return sep.join(dict.fromkeys(p for p in parts if p))


def tidy(s):
    """Drop wiki-side glitches: missing prices ("for t") and stray trailing periods."""
    return s.replace(" for t", "").rstrip(".")


def item(items, name, tag):
    """The Items row for `name` if it carries `tag`, else None."""
    row = items.get(name)
    return row if row and tag in row["tags"].split(",") else None


# --- Gifts ---------------------------------------------------------------
gifts = {}
for p in cargo("GiftPrefs", "charName,itemName,interest", 'interest IN ("love","like")'):
    gifts.setdefault(p["charName"], {"love": set(), "like": set()})[p["interest"].lower()].add(p["itemName"])
gifts = {k: {"love": sorted(v["love"]), "like": sorted(v["like"])} for k, v in sorted(gifts.items())}

universal = {}
for kind in ("Lovable", "Likeable"):
    rows = cargo("Items", "itemName", f'tags HOLDS "{kind}" AND tags HOLDS NOT "Unreleased"')
    universal[kind.lower()] = sorted(r["itemName"] for r in rows)

# --- Recipes -------------------------------------------------------------
# (type, table, fields, where, source cleaner). Cooking uses <br> between alternative
# sources; woodcrafting uses it inside a single source.
RECIPE_TABLES = [
    ("Cooking", "Recipes", "itemName,recipeSource", 'craftType="Food"', lambda s: clean_list(s, "; ")),
    ("Woodcrafting", "FurnitureTEMP", "itemName,recipeSource",
     'recipeSource IS NOT NULL AND NOT recipeSource="Unknown"', clean),
]
recipes = []
for rtype, table, fields, where, cleaner in RECIPE_TABLES:
    for r in cargo(table, fields, where):
        if r["recipeSource"]:
            recipes.append({"name": r["itemName"], "type": rtype, "source": tidy(cleaner(r["recipeSource"]))})
recipes.sort(key=lambda r: (r["type"], r["name"]))

# --- Fish & insects ------------------------------------------------------
items = {r["itemName"]: r for r in cargo("Items", "itemName,location,season,tags",
                                          '(tags HOLDS "Fish" OR tags HOLDS "Bug") AND tags HOLDS NOT "Unreleased"')}
fish = []
for f in cargo("Fish", "fishName,rarity,size,weather,diving"):
    it = item(items, f["fishName"], "Fish")
    if not it:
        continue
    loc, itags = clean(it["location"]), it["tags"].split(",")
    if loc == "Fish Trap":
        method = "Fish trap"
    elif "Fish:Diving Only" in itags:
        method = "Diving"
    else:
        method = "Pole (bait)" if "Bait Fish" in itags else "Pole"
        if f["diving"] == "1":
            method += ", Diving"
    fish.append({"name": f["fishName"], "location": loc, "season": clean_list(it["season"]),
                 "weather": clean_list(f["weather"]), "method": method,
                 "size": f["size"], "rarity": f["rarity"]})
fish.sort(key=lambda r: r["name"])

bugs = {}  # keyed by name: the Bugs table repeats some rows
for b in cargo("Bugs", "name,rarity,weather,season,time,spawnCondition"):
    it = item(items, b["name"], "Bug")
    if it:
        bugs[b["name"]] = {"name": b["name"], "location": clean_list(it["location"]),
                           "season": clean_list(b["season"]), "weather": clean_list(b["weather"]),
                           "time": clean(b["time"]), "condition": clean(b["spawnCondition"]),
                           "rarity": clean(b["rarity"])}
bugs = [bugs[k] for k in sorted(bugs)]

data = {"universal": universal, "gifts": gifts, "recipes": recipes, "fish": fish, "bugs": bugs}
with open("data.js", "w") as f:
    f.write("const DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
print(f"npcs={len(gifts)} recipes={len(recipes)} fish={len(fish)} bugs={len(bugs)}")
