/**
 * build-data.ts — bakes public/counties.json from public data sources.
 *
 * Phase 1 (this version, NO API key): CDC county-level Lyme case counts only.
 * Phase 2 (later, needs CENSUS_API_KEY): + ACS income/single-family + CBP competition + Gazetteer.
 *
 * Run: npx tsx scripts/build-data.ts
 *
 * Join key is the 5-digit county FIPS string. We join on FIPS ONLY — the CDC file misspells
 * county/state names ("Massachussetts") and is latin-1 encoded.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { percentileRanks } from '../src/lib/score';
import type { CountyDatum, CountyDataset, IncidenceStatus } from '../src/lib/types';

const CDC_LYME_CSV =
  'https://www.cdc.gov/lyme/media/files/2025/02/LD_Case_Counts_by_County_2023_updated.csv';

const PUBLIC = resolve(process.cwd(), 'public');

function pad(n: string, len: number): string {
  return n.trim().padStart(len, '0');
}

// CDC source misspells one state; fix it for display (we still join on FIPS, never name).
const STATE_FIX: Record<string, string> = { Massachussetts: 'Massachusetts' };
const fixState = (s: string) => STATE_FIX[s] ?? s;

/** Fetch the CDC CSV as latin-1 text, with fail-loud guards on HTTP and schema. */
async function fetchLymeCsv(): Promise<string> {
  const res = await fetch(CDC_LYME_CSV);
  if (!res.ok) throw new Error(`CDC CSV fetch failed: HTTP ${res.status} ${CDC_LYME_CSV}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('latin1'); // CDC file is latin-1; UTF-8 throws on 0xf1 (e.g. Doña Ana)
}

interface ParsedLyme {
  fips: string;
  name: string;
  state: string;
  incidenceStatus: IncidenceStatus;
  lyme2023: number;
  lymeAvg: number;
}

/**
 * Connecticut crosswalk. Starting with 2022, CT replaced its 8 counties with 9 planning
 * regions (FIPS 091xx); the CDC 2023 file reports CT cases at the planning-region level, but
 * the us-atlas map only has the OLD county shapes (0900x). The old-county rows in the CSV are
 * zeroed placeholders. To avoid leaving high-Lyme CT blank, we redistribute each planning
 * region's counts onto the old county(ies) it predominantly overlaps (population-weighted,
 * fractions sum to 1 so the statewide total is preserved). This is an APPROXIMATION at the
 * county shape level — Phase 2 should switch to a 2023-vintage county map for exactness.
 */
const CT_CROSSWALK: Record<string, Array<[string, number]>> = {
  '09110': [['09003', 0.82], ['09013', 0.18]], // Capitol → Hartford + Tolland
  '09120': [['09001', 1.0]], // Greater Bridgeport → Fairfield
  '09130': [['09007', 1.0]], // Lower CT River Valley → Middlesex
  '09140': [['09009', 1.0]], // Naugatuck Valley → New Haven
  '09150': [['09015', 0.85], ['09013', 0.15]], // Northeastern → Windham + Tolland
  '09160': [['09005', 1.0]], // Northwest Hills → Litchfield
  '09170': [['09009', 1.0]], // South Central → New Haven
  '09180': [['09011', 1.0]], // Southeastern → New London
  '09190': [['09001', 1.0]], // Western CT → Fairfield
};

/** Redistribute CT planning-region rows onto old county shapes; drop the region rows. */
function applyCtCrosswalk(rows: ParsedLyme[]): ParsedLyme[] {
  const byFips = new Map(rows.map((r) => [r.fips, r]));
  for (const [region, targets] of Object.entries(CT_CROSSWALK)) {
    const src = byFips.get(region);
    if (!src) continue;
    for (const [county, frac] of targets) {
      const dst = byFips.get(county);
      if (!dst) continue;
      dst.lyme2023 += src.lyme2023 * frac;
      dst.lymeAvg += src.lymeAvg * frac;
      // Any CT county receiving cases is High Incidence (all CT is).
      if (src.incidenceStatus === 'High') dst.incidenceStatus = 'High';
    }
  }
  // Round and drop the planning-region rows (not on the map).
  return rows
    .filter((r) => !(r.fips in CT_CROSSWALK))
    .map((r) => ({ ...r, lyme2023: Math.round(r.lyme2023), lymeAvg: Math.round(r.lymeAvg * 10) / 10 }));
}

function parseLyme(csv: string): ParsedLyme[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`CDC CSV missing expected column "${name}". Schema drift?`);
    return i;
  };
  const iName = idx('ctyname');
  const iState = idx('stname');
  const iStatus = idx('ststatus');
  const iStcode = idx('stcode');
  const iCtycode = idx('ctycode');
  const i2023 = idx('cases2023');
  const i2022 = idx('cases2022');
  const i2021 = idx('cases2021');

  const rows: ParsedLyme[] = [];
  for (let n = 1; n < lines.length; n++) {
    const c = lines[n].split(',');
    if (c.length !== header.length) continue; // skip malformed rows
    const v2023 = Number(c[i2023]) || 0;
    const v2022 = Number(c[i2022]) || 0;
    const v2021 = Number(c[i2021]) || 0;
    rows.push({
      fips: pad(c[iStcode], 2) + pad(c[iCtycode], 3),
      name: c[iName].trim(),
      state: fixState(c[iState].trim()),
      incidenceStatus: c[iStatus].trim().startsWith('High') ? 'High' : 'Low',
      lyme2023: v2023,
      lymeAvg: Math.round(((v2021 + v2022 + v2023) / 3) * 10) / 10,
    });
  }
  if (rows.length < 3000) throw new Error(`Only parsed ${rows.length} counties — expected >3000.`);
  return rows;
}

/** Read the us-atlas county FIPS ids for reconciliation. */
function mapFips(): Set<string> {
  const topo = JSON.parse(readFileSync(resolve(PUBLIC, 'counties-10m.json'), 'utf8'));
  const geoms = topo.objects.counties.geometries as Array<{ id: string }>;
  return new Set(geoms.map((g) => g.id));
}

async function main() {
  console.log('Fetching CDC Lyme county CSV…');
  const rows = applyCtCrosswalk(parseLyme(await fetchLymeCsv()));
  console.log(`Parsed ${rows.length} counties; US 2023 total = ${rows.reduce((s, r) => s + r.lyme2023, 0)}`);

  // Percentile-normalize Lyme (use 3-yr avg for stability).
  const lymeNorms = percentileRanks(rows.map((r) => r.lymeAvg));

  const counties: Record<string, CountyDatum> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    counties[r.fips] = {
      ...r,
      income: null,
      sfUnits: null,
      sfShare: null,
      sfPerSqMi: null,
      competitors: null,
      norm: { lyme: Math.round(lymeNorms[i] * 10) / 10, income: null, density: null, competition: null },
    };
  }

  // Reconcile against the map's feature set (Gary's rule: account for every bucket).
  const features = mapFips();
  const dataFips = new Set(Object.keys(counties));
  const matched = [...dataFips].filter((f) => features.has(f));
  const dataNotOnMap = [...dataFips].filter((f) => !features.has(f));
  const mapNoData = [...features].filter((f) => !dataFips.has(f));
  console.log('\n=== RECONCILIATION ===');
  console.log(`Map features (us-atlas counties): ${features.size}`);
  console.log(`Lyme data rows: ${dataFips.size}`);
  console.log(`Matched (render with data): ${matched.length}`);
  console.log(`Data rows not on map: ${dataNotOnMap.length}`, dataNotOnMap.slice(0, 10));
  console.log(`Map features with no Lyme data (render neutral): ${mapNoData.length}`, mapNoData.slice(0, 10));

  const dataset: CountyDataset = {
    generatedAt: new Date().toISOString(),
    phase: 1,
    reconciliation: { mapFeatures: features.size, dataMatched: matched.length },
    counties,
  };
  writeFileSync(resolve(PUBLIC, 'counties.json'), JSON.stringify(dataset));
  console.log(`\nWrote public/counties.json (${dataFips.size} counties).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
