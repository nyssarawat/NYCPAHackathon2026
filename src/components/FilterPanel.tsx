'use client';

import type { Filters, CompositeWeights } from '@/lib/types';

interface Props {
  filters: Filters;
  weights: CompositeWeights;
  phase: 1 | 2;
  visible: number;
  total: number;
  onFilters: (f: Filters) => void;
  onWeights: (w: CompositeWeights) => void;
}

function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className={`block ${disabled ? 'opacity-40' : ''}`}>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">
          {value}
          {suffix ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-400 disabled:cursor-not-allowed"
      />
    </label>
  );
}

export default function FilterPanel({ filters, weights, phase, visible, total, onFilters, onWeights }: Props) {
  const p2 = phase < 2;
  const setF = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });
  const setW = (patch: Partial<CompositeWeights>) => onWeights({ ...weights, ...patch });

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filters</span>
          <span className="text-[11px] tabular-nums text-emerald-400">
            {visible.toLocaleString()} / {total.toLocaleString()} shown
          </span>
        </div>
        <div className="space-y-3">
          <Slider
            label="Min Lyme percentile"
            value={filters.lymeMin}
            onChange={(v) => setF({ lymeMin: v })}
          />
          <div>
            <div className="mb-1 text-xs text-slate-300">CDC incidence</div>
            <div className="flex gap-1">
              {(['all', 'High', 'Low'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setF({ incidence: opt })}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs capitalize ${
                    filters.incidence === opt
                      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Min SF-home density pct"
            value={filters.densityMin}
            disabled={p2}
            onChange={(v) => setF({ densityMin: v })}
          />
          <Slider
            label="Max competition pct"
            value={filters.competitionMax}
            disabled={p2}
            onChange={(v) => setF({ competitionMax: v })}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Opportunity weights
        </div>
        <div className="space-y-3">
          <Slider label="Lyme demand" value={weights.lyme} min={0} max={2} step={0.1} onChange={(v) => setW({ lyme: v })} />
          <Slider
            label="Buying power"
            value={weights.income}
            min={0}
            max={2}
            step={0.1}
            disabled={p2}
            onChange={(v) => setW({ income: v })}
          />
          <Slider
            label="SF density"
            value={weights.density}
            min={0}
            max={2}
            step={0.1}
            disabled={p2}
            onChange={(v) => setW({ density: v })}
          />
          <Slider
            label="Competition penalty"
            value={weights.competition}
            min={0}
            max={2}
            step={0.1}
            disabled={p2}
            onChange={(v) => setW({ competition: v })}
          />
        </div>
      </div>
    </div>
  );
}
