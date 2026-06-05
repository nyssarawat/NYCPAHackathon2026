import type { CountyDatum, CountyNorms, CompositeWeights, Layer } from './types';

/**
 * Percentile-rank normalization (0–100). For each value, returns the fraction of
 * counties with a STRICTLY smaller value × 100. Ties share the same (minimum) percentile.
 *
 * Why percentile rank, not min-max: Lyme counts are heavy-tailed (Suffolk NY ~3,262 vs a
 * median county of ~1). Min-max would crush 95% of counties into the bottom color bin.
 * Percentile rank spreads them evenly so the map is readable. Counties at 0 map to 0.
 */
export function percentileRanks(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  // For each value, binary-search the index of the first equal element = count strictly less.
  return values.map((v) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return n > 1 ? (lo / (n - 1)) * 100 : 0;
  });
}

/** Default weights — the tool's opinion on what makes a good target county. Tunable in the UI. */
export const DEFAULT_WEIGHTS: CompositeWeights = {
  lyme: 1, // demand: more Lyme = more reason to spray
  income: 0.7, // ability to pay
  density: 0.6, // single-family density = reachable rooftops per flight
  competition: 0.8, // existing pest-control presence (penalty)
};

/**
 * Composite opportunity score (0–100) from a county's normalized metrics + weights.
 *
 * Opportunity = w1·Lyme + w2·Income + w3·Density − w4·Competition, rescaled to 0–100 by the
 * sum of positive weights so the output stays comparable as the user tunes sliders.
 * Missing metrics (Phase 1, or CBP gaps) drop out of both numerator and denominator, so the
 * score degrades gracefully to whatever data exists (Phase 1 composite == Lyme percentile).
 */
export function computeComposite(norms: CountyNorms, w: CompositeWeights): number {
  let positive = 0;
  let positiveWeight = 0;

  positive += w.lyme * norms.lyme;
  positiveWeight += w.lyme;
  if (norms.income !== null) {
    positive += w.income * norms.income;
    positiveWeight += w.income;
  }
  if (norms.density !== null) {
    positive += w.density * norms.density;
    positiveWeight += w.density;
  }
  if (positiveWeight === 0) return 0;

  const base = positive / positiveWeight; // 0–100
  const penalty = norms.competition !== null ? w.competition * norms.competition : 0;
  // Penalty is a fraction of the competition weight relative to the positive weight budget.
  const penaltyScaled = penalty / (positiveWeight + w.competition);
  return Math.max(0, Math.min(100, base - penaltyScaled));
}

/** Normalized 0–100 value driving the color scale for a given layer. null = no data. */
export function layerValue(d: CountyDatum, layer: Layer, w: CompositeWeights): number | null {
  if (layer === 'composite') return computeComposite(d.norm, w);
  return d.norm[layer];
}
