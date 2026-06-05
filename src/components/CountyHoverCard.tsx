'use client';

import type { CountyDatum, CompositeWeights } from '@/lib/types';
import { computeComposite } from '@/lib/score';

interface Props {
  datum: CountyDatum;
  weights: CompositeWeights;
  x: number;
  y: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium tabular-nums text-slate-100">{value}</span>
    </div>
  );
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

export default function CountyHoverCard({ datum, weights, x, y }: Props) {
  const composite = Math.round(computeComposite(datum.norm, weights));
  // Flip to the left/up near viewport edges.
  const left = x + 280 > window.innerWidth ? x - 268 : x + 16;
  const top = y + 240 > window.innerHeight ? y - 224 : y + 16;

  return (
    <div
      className="pointer-events-none fixed z-50 w-64 rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-xs shadow-2xl backdrop-blur"
      style={{ left, top }}
    >
      <div className="mb-2 border-b border-slate-700 pb-2">
        <div className="text-sm font-semibold text-white">{datum.name}</div>
        <div className="text-slate-400">{datum.state}</div>
      </div>
      <div className="space-y-1.5">
        <Row label="Opportunity score" value={`${composite}/100`} />
        <Row label="Lyme cases (3-yr avg)" value={datum.lymeAvg.toLocaleString('en-US')} />
        <Row label="CDC incidence" value={`${datum.incidenceStatus} incidence`} />
        {datum.income !== null && <Row label="Median income" value={usd(datum.income)} />}
        {datum.sfPerSqMi !== null && <Row label="SF homes / sq mi" value={datum.sfPerSqMi.toFixed(1)} />}
        {datum.competitors !== null && <Row label="Pest-control firms" value={String(datum.competitors)} />}
      </div>
    </div>
  );
}
