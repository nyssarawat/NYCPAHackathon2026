'use client';

import type { Layer } from '@/lib/types';
import { LAYER_META, LAYER_ORDER, type MetricAvailability } from '@/lib/colorScale';

interface Props {
  active: Layer;
  available: MetricAvailability;
  onChange: (l: Layer) => void;
}

export default function LayerToggle({ active, available, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Map metric</div>
      <div className="grid gap-1.5">
        {LAYER_ORDER.map((l) => {
          const meta = LAYER_META[l];
          const locked = meta.phase2 && !available[l as keyof MetricAvailability];
          const isActive = active === l;
          return (
            <button
              key={l}
              type="button"
              disabled={locked}
              onClick={() => onChange(l)}
              title={`${meta.tip} — Source: ${meta.source}`}
              className={[
                'rounded-lg border px-3 py-2 text-left transition',
                isActive
                  ? 'border-emerald-400 bg-emerald-400/10'
                  : 'border-slate-700 hover:border-slate-500',
                locked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-100">
                  {meta.label}
                  <span className="ml-1 cursor-help text-slate-500" aria-hidden>
                    ⓘ
                  </span>
                </span>
                {locked && <span className="text-[10px] uppercase text-amber-400">needs key</span>}
              </div>
              <div className="text-[11px] text-slate-400">{meta.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
