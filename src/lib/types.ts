// Shared types for the Tick Territory dataset.
// Everything joins on a 5-digit county FIPS string.

export type Layer = 'lyme' | 'income' | 'density' | 'competition' | 'composite';

export type IncidenceStatus = 'High' | 'Low';

/** Normalized 0–100 percentile-rank scores. null = data not yet available (Phase 1). */
export interface CountyNorms {
  lyme: number;
  income: number | null;
  density: number | null;
  competition: number | null;
}

export interface CountyDatum {
  fips: string;
  name: string;
  state: string;
  incidenceStatus: IncidenceStatus;
  /** Raw CDC values. */
  lyme2023: number;
  lymeAvg: number; // mean of 2021–2023
  /** Phase 2 raw values (null until Census key lands). */
  income: number | null; // median household income $
  sfUnits: number | null; // single-family housing units (1-unit detached + attached)
  sfShare: number | null; // SF units / total housing units
  sfPerSqMi: number | null; // SF units per sq mi land area
  competitors: number | null; // pest-control establishments (NAICS 561710)
  norm: CountyNorms;
}

export interface CountyDataset {
  /** Stamped after the build returns (scripts can't call Date.now under some harnesses). */
  generatedAt: string | null;
  phase: 1 | 2;
  /** Reconciliation summary so the map can show data coverage honestly. */
  reconciliation: {
    mapFeatures: number; // us-atlas county features (3231)
    dataMatched: number; // counties with Lyme data
  };
  counties: Record<string, CountyDatum>;
}

/** UI weights for the composite opportunity score (0–1 each). */
export interface CompositeWeights {
  lyme: number;
  income: number;
  density: number;
  competition: number; // applied as a penalty (subtracted)
}

/** Filters subset which counties render (normalized 0–100 thresholds). */
export interface Filters {
  lymeMin: number; // show counties with Lyme percentile ≥ this
  densityMin: number; // show SF density percentile ≥ this (Phase 2)
  competitionMax: number; // show competition percentile ≤ this (Phase 2)
  incidence: 'all' | 'High' | 'Low';
}
