import {
  interpolateYlOrRd,
  interpolateGreens,
  interpolatePuBu,
  interpolateReds,
  interpolateViridis,
} from 'd3-scale-chromatic';
import type { Layer } from './types';

const INTERP: Record<Layer, (t: number) => string> = {
  lyme: interpolateYlOrRd,
  income: interpolateGreens,
  density: interpolatePuBu,
  competition: interpolateReds,
  composite: interpolateViridis,
};

export const NO_DATA = '#e5e7eb'; // neutral gray
export const FILTERED_OUT = '#f8fafc'; // near-white, de-emphasized

/** Color for a normalized 0–100 value on a layer. null → neutral gray. */
export function colorFor(layer: Layer, norm: number | null): string {
  if (norm === null || Number.isNaN(norm)) return NO_DATA;
  // Compress to 0.12–1 so low-but-present values aren't invisible white.
  return INTERP[layer](0.12 + 0.88 * (Math.max(0, Math.min(100, norm)) / 100));
}

export interface LayerInfo {
  label: string;
  sub: string;
  /** false until the Census key is wired in Phase 2. */
  phase2: boolean;
  /** One-line definition of what the metric measures (shown on hover). */
  tip: string;
  /** Data provenance (shown on hover). */
  source: string;
}

export const LAYER_META: Record<Layer, LayerInfo> = {
  lyme: {
    label: 'Lyme incidence',
    sub: 'CDC cases / county (3-yr avg)',
    phase2: false,
    tip: '3-yr average of confirmed Lyme disease cases reported in the county.',
    source: 'CDC Lyme disease surveillance, 2021–2023.',
  },
  composite: {
    label: 'Opportunity score',
    sub: 'Composite target ranking',
    phase2: false,
    tip: 'Weighted blend of the metrics: + Lyme + income + density − competition, tunable below.',
    source: 'Derived from the metrics below.',
  },
  income: {
    label: 'Buying power',
    sub: 'Median household income',
    phase2: true,
    tip: 'Median household income — a proxy for ability to pay for recurring tick-control service.',
    source: 'Census ACS 5-year 2021, variable B19013.',
  },
  density: {
    label: 'Single-family density',
    sub: 'SF homes per sq mi',
    phase2: true,
    tip: 'Single-family homes per square mile — reachable rooftops per service route.',
    source: 'Census ACS + Census Gazetteer (pending).',
  },
  competition: {
    label: 'Competition',
    sub: 'Pest-control firms (NAICS 561710)',
    phase2: true,
    tip: 'Existing pest-control establishments in the county — applied as a penalty.',
    source: 'Census County Business Patterns, NAICS 561710 (pending).',
  },
};

export const LAYER_ORDER: Layer[] = ['composite', 'lyme', 'income', 'density', 'competition'];

/** Which Phase-2 metrics actually have data loaded — drives UI locks per-metric (not a coarse phase flag). */
export type MetricAvailability = Record<'income' | 'density' | 'competition', boolean>;
