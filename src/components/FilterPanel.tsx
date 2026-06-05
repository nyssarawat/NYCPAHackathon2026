'use client';

import type { Filters, CompositeWeights } from '@/lib/types';
import { LAYER_META, type MetricAvailability } from '@/lib/colorScale';

interface Props {
  filters: Filters;
  weights: CompositeWeights;
  available: MetricAvailability;
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
  info,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
  info?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className={`block ${disabled ? 'opacity-40' : ''}`} title={info}>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-300">
          {label}
          {info && (
            <span className="ml-1 cursor-help text-slate-500" aria-hidden>
              ⓘ
            </span>
          )}
        </span>
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

export default function FilterPanel({ filters, weights, available, visible, total, onFilters, onWeights }: Props) {
  const setF = (patch: Partial<Filters>) => onFilters({ ...filters, ...patch });
  const setW = (patch: Partial<CompositeWeights>) => onWeights({ ...weights, ...patch });
  const tip = (m: 'lyme' | 'income' | 'density' | 'competition') =>
    `${LAYER_META[m].tip} — Source: ${LAYER_META[m].source}`;

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
            info={tip('lyme')}
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
            disabled={!available.density}
            info={tip('density')}
            onChange={(v) => setF({ densityMin: v })}
          />
          <Slider
            label="Max competition pct"
            value={filters.competitionMax}
            disabled={!available.competition}
            info={tip('competition')}
            onChange={(v) => setF({ competitionMax: v })}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Opportunity weights
        </div>
        <div className="space-y-3">
          <Slider
            label="Lyme risk"
            value={weights.lyme}
            min={0}
            max={2}
            step={0.1}
            info={tip('lyme')}
            onChange={(v) => setW({ lyme: v })}
          />
          <Slider
            label="Buying power"
            value={weights.income}
            min={0}
            max={2}
            step={0.1}
            disabled={!available.income}
            info={tip('income')}
            onChange={(v) => setW({ income: v })}
          />
          <Slider
            label="SF density"
            value={weights.density}
            min={0}
            max={2}
            step={0.1}
            disabled={!available.density}
            info={tip('density')}
            onChange={(v) => setW({ density: v })}
          />
          <Slider
            label="Competition penalty"
            value={weights.competition}
            min={0}
            max={2}
            step={0.1}
            disabled={!available.competition}
            info={tip('competition')}
            onChange={(v) => setW({ competition: v })}
          />
        </div>
      </div>
    </div>
  );
}
