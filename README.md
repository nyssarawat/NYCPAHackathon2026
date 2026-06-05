# Tick Territory

County-level USA heat map for a tick-control company to target markets. Overlays CDC Lyme
incidence with (Phase 2) buying power, single-family density, and existing competition, and ranks
counties by a composite **opportunity score**:
`high Lyme + high income + high SF density + LOW competition = ideal county`.

## Status

- **Phase 1 (shipped):** Lyme choropleth from CDC county data — no API key needed. Layer toggle,
  Lyme percentile + incidence filters, per-county hover, top-opportunities list, composite score.
- **Phase 2 (pending Census key):** income (ACS), single-family density (ACS + Gazetteer),
  competition (CBP). Get a free key at https://api.census.gov/data/key_signup.html, put it in
  `.env.local` as `CENSUS_API_KEY=…`, then extend `scripts/build-data.ts` (see plan).

## Run

```bash
npm install
npm run build:data   # bakes public/counties.json from the CDC CSV (network)
npm run dev          # http://localhost:3000
```

## Architecture

- `scripts/build-data.ts` — fetches CDC Lyme county CSV (latin-1), joins on 5-digit FIPS,
  reconciles against the map's 3,231 features, percentile-normalizes, writes `public/counties.json`.
- `src/components/ChoroplethMap.tsx` — d3-geo `geoAlbersUsa` SVG over us-atlas county topojson.
- `src/lib/score.ts` — percentile normalization + composite opportunity score (weights tunable in UI).

## Data notes

- **Join on FIPS only** — the CDC file is latin-1 and misspells county/state names.
- **Connecticut** is reported by the CDC at the new planning-region level; we crosswalk it back onto
  the old county shapes used by us-atlas (population-weighted, statewide total preserved). Phase 2
  should keep Census at the **2021 vintage** to match. See `CT_CROSSWALK` in `scripts/build-data.ts`.
- Reconciliation: 3,142 counties render with data; ~89 map features (Puerto Rico, territories) have
  no CDC Lyme data and render neutral gray.
