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
}

export const LAYER_META: Record<Layer, LayerInfo> = {
  lyme: { label: 'Lyme incidence', sub: 'CDC cases / county (3-yr avg)', phase2: false },
  composite: { label: 'Opportunity score', sub: 'Composite target ranking', phase2: false },
  income: { label: 'Buying power', sub: 'Median household income', phase2: true },
  density: { label: 'Single-family density', sub: 'SF homes per sq mi', phase2: true },
  competition: { label: 'Competition', sub: 'Pest-control firms (NAICS 561710)', phase2: true },
};

export const LAYER_ORDER: Layer[] = ['composite', 'lyme', 'income', 'density', 'competition'];
