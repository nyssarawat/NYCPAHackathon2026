'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CountyDataset, CountyDatum, CompositeWeights, Filters, Layer } from '@/lib/types';
import { DEFAULT_WEIGHTS, computeComposite } from '@/lib/score';
import { LAYER_META, type MetricAvailability } from '@/lib/colorScale';
import { asset } from '@/lib/basePath';
import ChoroplethMap from '@/components/ChoroplethMap';
import CountyHoverCard from '@/components/CountyHoverCard';
import LayerToggle from '@/components/LayerToggle';
import FilterPanel from '@/components/FilterPanel';

const INITIAL_FILTERS: Filters = { lymeMin: 0, densityMin: 0, competitionMax: 100, incidence: 'all' };

interface Hover {
  datum: CountyDatum;
  x: number;
  y: number;
}

export default function Home() {
  const [data, setData] = useState<CountyDataset | null>(null);
  const [activeLayer, setActiveLayer] = useState<Layer>('lyme');
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [weights, setWeights] = useState<CompositeWeights>(DEFAULT_WEIGHTS);
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    fetch(asset('/counties.json'))
      .then((r) => r.json())
      .then(setData)
      .catch((e) => console.error('counties.json load failed', e));
  }, []);

  const counties = useMemo(() => data?.counties ?? {}, [data]);

  // Gate Phase-2 UI on actual data availability, not a coarse phase flag: each metric unlocks
  // independently as soon as at least one county has a non-null norm for it.
  const available = useMemo<MetricAvailability>(() => {
    const vals = Object.values(counties);
    return {
      income: vals.some((d) => d.norm.income !== null),
      density: vals.some((d) => d.norm.density !== null),
      competition: vals.some((d) => d.norm.competition !== null),
    };
  }, [counties]);

  const pending = (['income', 'density', 'competition'] as const).filter((m) => !available[m]);

  const visibleFips = useMemo(() => {
    const s = new Set<string>();
    for (const [fips, d] of Object.entries(counties)) {
      if (d.norm.lyme < filters.lymeMin) continue;
      if (filters.incidence !== 'all' && d.incidenceStatus !== filters.incidence) continue;
      if (d.norm.density !== null && d.norm.density < filters.densityMin) continue;
      if (d.norm.competition !== null && d.norm.competition > filters.competitionMax) continue;
      s.add(fips);
    }
    return s;
  }, [counties, filters]);

  const topCounties = useMemo(() => {
    return [...visibleFips]
      .map((f) => counties[f])
      .map((d) => ({ d, score: computeComposite(d.norm, weights) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [visibleFips, counties, weights]);

  if (!data) {
    return <div className="grid h-screen place-items-center bg-slate-950 text-slate-400">Loading data…</div>;
  }

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Tick Territory <span className="text-emerald-400">·</span>{' '}
            <span className="font-normal text-slate-400">county market targeting</span>
          </h1>
          <p className="text-xs text-slate-500">
            {LAYER_META[activeLayer].label} — {LAYER_META[activeLayer].sub}
          </p>
        </div>
        {pending.length > 0 && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
            {available.income ? 'Income live · ' : 'Phase 1 · Lyme only · '}
            {pending.map((m) => LAYER_META[m].label).join(' + ')} pending Census key
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 space-y-6 overflow-y-auto border-r border-slate-800 p-5">
          <LayerToggle active={activeLayer} available={available} onChange={setActiveLayer} />
          <FilterPanel
            filters={filters}
            weights={weights}
            available={available}
            visible={visibleFips.size}
            total={Object.keys(counties).length}
            onFilters={setFilters}
            onWeights={setWeights}
          />
        </aside>

        <section className="relative min-w-0 flex-1 bg-slate-900/40">
          <ChoroplethMap
            counties={counties}
            activeLayer={activeLayer}
            weights={weights}
            visibleFips={visibleFips}
            onHover={(datum, x, y) => setHover(datum ? { datum, x, y } : null)}
          />
        </section>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-800 p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Top opportunities
          </div>
          <ol className="space-y-1.5">
            {topCounties.map(({ d, score }, i) => (
              <li
                key={d.fips}
                className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm hover:border-slate-600"
              >
                <span className="min-w-0 truncate">
                  <span className="mr-2 text-slate-500">{i + 1}.</span>
                  {d.name}
                  <span className="ml-1 text-xs text-slate-500">{d.state}</span>
                </span>
                <span className="ml-2 shrink-0 font-semibold tabular-nums text-emerald-400">
                  {Math.round(score)}
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {hover && <CountyHoverCard datum={hover.datum} weights={weights} x={hover.x} y={hover.y} />}
    </main>
  );
}
