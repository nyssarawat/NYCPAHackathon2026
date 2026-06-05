@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ⚠️ Next.js version warning above (`@AGENTS.md`) applies: this is Next.js 16 — read `node_modules/next/dist/docs/` before using any Next API you're unsure about.

## What this is

**Tick Territory** — a county-level US choropleth that helps a tick-control company target markets. It ranks all ~3,142 counties by a composite **opportunity score**: `high Lyme + high income + high single-family density + LOW competition = ideal county`.

- **Phase 1 (shipped):** CDC Lyme incidence only — no API key. Composite score == Lyme percentile.
- **Phase 2 (pending Census key):** adds income (ACS), single-family density (ACS + Gazetteer), competition (CBP NAICS 561710). Get a free key at the Census signup, put `CENSUS_API_KEY=…` in `.env.local`, then extend `scripts/build-data.ts`.

The dataset schema (`CountyDatum`/`CountyNorms` in `src/lib/types.ts`) already has nullable Phase-2 fields; null means "no data yet" and the scoring degrades gracefully — implement Phase 2 by filling those fields, not by reshaping the types.

## Commands

```bash
npm install
npm run build:data   # bakes public/counties.json from the CDC CSV — REQUIRES NETWORK
npm run dev          # http://localhost:3000
npm run build        # static export to out/ (this is what CI deploys)
npm run lint         # eslint
```

There is no test suite. `npm run build` (static export) is the verification gate — it must pass before committing.

`build:data` is a **separate, manual step** from `build`. The committed `public/counties.json` is the baked artifact; CI does NOT regenerate it. Only re-run `build:data` when changing the data pipeline, and commit the resulting `counties.json`.

## Architecture (the big picture)

Two-stage pipeline: an offline **bake** produces a static JSON the **client** renders. There is no server runtime — `output: "export"` in `next.config.ts`.

1. **`scripts/build-data.ts`** (Node, run via tsx) — fetches the CDC Lyme county CSV (and, when `CENSUS_API_KEY` is set in `.env.local`, ACS 2021 `B19013` median household income), joins them onto the us-atlas county map by 5-digit FIPS, percentile-normalizes, and writes `public/counties.json`. Imports `percentileRanks` from `src/lib/score.ts` so normalization is defined once and shared with the client. **Census rejects keyless requests** — the script fails loud with the signup URL if no key is set.
2. **`public/counties.json`** — the baked dataset (`CountyDataset`). Client fetches it at runtime.
3. **`src/app/page.tsx`** — `'use client'` root. Holds all state (active layer, filters, composite weights, hover). Derives `visibleFips` (filters) and `topCounties` (sorted by live composite score) with `useMemo`. **Phase-2 UI gating is per-metric and data-driven** — it derives an `available` map (income/density/competition) from whether any county has that non-null norm, and threads it to `LayerToggle`/`FilterPanel`. It does NOT key off the coarse `phase` flag, so loading only income unlocks only income.
4. **`src/components/ChoroplethMap.tsx`** — d3-geo `geoAlbersUsa` SVG over us-atlas county topojson, with d3-zoom pan/zoom (wheel, drag, double-click, `+`/`−`/`Reset`); strokes scale by `1/k` to stay crisp.
5. **`src/lib/score.ts`** — `percentileRanks`, `computeComposite`, `DEFAULT_WEIGHTS`. The composite is recomputed live in the browser as the user moves weight sliders; the bake only stores percentile norms, not the final score.

## Non-obvious invariants — read before touching data

These are documented at length in `scripts/build-data.ts` and `README.md`; the short version:

- **Join on 5-digit FIPS ONLY, never on name.** The CDC CSV is **latin-1 encoded** (UTF-8 decode throws on bytes like 0xf1 in "Doña Ana") and misspells names ("Massachussetts"). `fetchLymeCsv` reads it as latin1 on purpose; `STATE_FIX` patches display names only.
- **Connecticut crosswalk.** CDC reports CT at the new 9 planning-region FIPS (091xx), but us-atlas only has the old 8 county shapes (0900x). `CT_CROSSWALK` redistributes region counts onto old counties population-weighted (fractions sum to 1, statewide total preserved). This is an approximation — Phase 2 should keep Census at the **2021 vintage** to match, or switch to a 2023-vintage county map.
- **Percentile rank, not min-max.** Lyme counts are heavy-tailed (Suffolk NY ~3,262 vs median ~1); min-max would crush 95% of counties into the bottom color bin. See the comment in `percentileRanks`.
- **Reconciliation is tracked honestly.** ~3,142 counties get data; ~89 map features (Puerto Rico, territories) have no CDC data and render neutral gray. `dataset.reconciliation` records this.
- **No `Date.now()` in the bake.** Some harnesses forbid it (it breaks resume). `generatedAt` is stamped after the build returns, not inside it.

## Deployment & base path

Auto-deploys to **GitHub Pages** on push to `main` via `.github/workflows/deploy-pages.yml` (build → static export → upload → deploy).

GitHub Pages serves a project site from `/<repo-name>`, so the workflow sets `NEXT_PUBLIC_BASE_PATH=/<repo-name>` at build time (derived from the repo name so a rename can't break paths). It's **empty locally and on Vercel**.

Critical gotcha: **Next.js rewrites links/imports under `basePath` but does NOT rewrite `fetch()` URLs.** Any runtime fetch of a `/public` asset must go through `asset()` in `src/lib/basePath.ts` — that's why `page.tsx` does `fetch(asset('/counties.json'))`. New runtime asset fetches must use `asset()` or they 404 on Pages.
