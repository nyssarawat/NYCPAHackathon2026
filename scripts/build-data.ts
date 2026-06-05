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
import { config } from 'dotenv';
import { percentileRanks } from '../src/lib/score';
import type { CountyDatum, CountyDataset, IncidenceStatus } from '../src/lib/types';

config({ path: '.env.local' }); // optional CENSUS_API_KEY; Census may reject keyless requests.

const CDC_LYME_CSV =
  'https://www.cdc.gov/lyme/media/files/2025/02/LD_Case_Counts_by_County_2023_updated.csv';

// Phase 2 income. ACS 5-year, 2021 vintage ON PURPOSE: 2021 reports CT at the OLD county FIPS
// (0900x) the us-atlas map uses; 2022+ switched to 091xx planning regions and would break the join.
const ACS_YEAR = 2021;
const ACS_INCOME_VAR = 'B19013_001E'; // median household income, past 12 months
const CENSUS_KEY = process.env.CENSUS_API_KEY?.trim();

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

/**
 * Fetch ACS median household income for every county, keyed by 5-digit FIPS.
 * Key-optional: uses CENSUS_API_KEY if set, else calls keyless — but Census increasingly rejects
 * keyless requests, so we fail LOUD with the free-signup URL rather than degrade silently.
 */
async function fetchAcsIncome(): Promise<Map<string, number>> {
  const url =
    `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?get=NAME,${ACS_INCOME_VAR}&for=county:*` +
    (CENSUS_KEY ? `&key=${CENSUS_KEY}` : '');
  const res = await fetch(url);
  const body = await res.text();
  // Census returns an HTML error page (not JSON) when keyless/invalid — detect that, don't JSON.parse it.
  const looksJson = body.trimStart().startsWith('[');
  if (!res.ok || !looksJson) {
    const hint = CENSUS_KEY
      ? 'CENSUS_API_KEY appears invalid or rate-limited.'
      : 'Census rejects keyless requests — get a free instant key at https://api.census.gov/data/key_signup.html and add CENSUS_API_KEY=… to .env.local, then re-run `npm run build:data`.';
    throw new Error(`Census ACS fetch failed (HTTP ${res.status}). ${hint}`);
  }

  // Response is a 2-D JSON array; row 0 is the header. Resolve columns by name, never by position.
  const rows = JSON.parse(body) as string[][];
  const header = rows[0];
  const iVal = header.indexOf(ACS_INCOME_VAR);
  const iState = header.indexOf('state');
  const iCounty = header.indexOf('county');
  if (iVal < 0 || iState < 0 || iCounty < 0) {
    throw new Error(`ACS response missing expected columns. Got header: ${header.join(',')}`);
  }

  const income = new Map<string, number>();
  for (let n = 1; n < rows.length; n++) {
    const r = rows[n];
    const fips = pad(r[iState], 2) + pad(r[iCounty], 3);
    const v = Number(r[iVal]);
    // ACS jam/annotation values are negative sentinels (-666666666, -999999999, …) — drop all <0.
    if (!Number.isFinite(v) || v < 0) continue;
    income.set(fips, v);
  }

  // Vintage drift guard: 2021 must report CT at OLD county FIPS (0900x), not 091xx planning regions.
  const hasPlanningRegions = [...income.keys()].some((f) => /^091\d\d$/.test(f));
  const hasOldCtCounties = [...income.keys()].some((f) => /^0900\d$/.test(f));
  if (hasPlanningRegions || !hasOldCtCounties) {
    console.warn(
      `⚠️  ACS vintage drift: expected CT old counties (0900x), got planningRegions=${hasPlanningRegions} oldCounties=${hasOldCtCounties}. The CT join will be wrong — keep ACS_YEAR at a pre-2022 vintage.`,
    );
  }
  return income;
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

  console.log(`Fetching ACS ${ACS_YEAR} median household income${CENSUS_KEY ? ' (with key)' : ' (keyless)'}…`);
  const income = await fetchAcsIncome();
  console.log(`Got income for ${income.size} counties.`);

  // Percentile-normalize Lyme (use 3-yr avg for stability).
  const lymeNorms = percentileRanks(rows.map((r) => r.lymeAvg));

  // Percentile-normalize income over ONLY the counties that have it (same util as Lyme).
  const incomeRows = rows.filter((r) => income.has(r.fips));
  const incomeRanks = percentileRanks(incomeRows.map((r) => income.get(r.fips) as number));
  const incomeNorm = new Map(incomeRows.map((r, i) => [r.fips, Math.round(incomeRanks[i] * 10) / 10]));

  const counties: Record<string, CountyDatum> = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    counties[r.fips] = {
      ...r,
      income: income.get(r.fips) ?? null,
      sfUnits: null,
      sfShare: null,
      sfPerSqMi: null,
      competitors: null,
      norm: {
        lyme: Math.round(lymeNorms[i] * 10) / 10,
        income: incomeNorm.get(r.fips) ?? null,
        density: null,
        competition: null,
      },
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

  // Income reconciliation (Gary's rule: account for every bucket).
  const withIncome = Object.values(counties).filter((c) => c.income !== null);
  const noIncome = Object.values(counties).filter((c) => c.income === null);
  const ctWithIncome = withIncome.filter((c) => /^0900\d$/.test(c.fips));
  console.log(`\n=== INCOME RECONCILIATION (ACS ${ACS_YEAR}) ===`);
  console.log(`Counties with income: ${withIncome.length} / ${Object.keys(counties).length}`);
  console.log(
    `Counties without income (norm.income=null): ${noIncome.length}`,
    noIncome.slice(0, 10).map((c) => `${c.fips} ${c.name}`),
  );
  console.log(`CT old-county shapes with income (expect 8): ${ctWithIncome.length}`, ctWithIncome.map((c) => c.fips));

  const phase: 1 | 2 = withIncome.length > 0 ? 2 : 1;
  const dataset: CountyDataset = {
    generatedAt: new Date().toISOString(),
    phase,
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
