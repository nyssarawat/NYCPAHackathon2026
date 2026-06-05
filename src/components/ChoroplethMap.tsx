'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { CountyDatum, CompositeWeights, Layer } from '@/lib/types';
import { layerValue } from '@/lib/score';
import { colorFor, FILTERED_OUT } from '@/lib/colorScale';

const W = 975;
const H = 610;

interface Props {
  counties: Record<string, CountyDatum>;
  activeLayer: Layer;
  weights: CompositeWeights;
  visibleFips: Set<string>;
  onHover: (datum: CountyDatum | null, x: number, y: number) => void;
}

interface TopoData {
  features: Feature<Geometry, { name: string }>[];
  countyPath: (f: Feature) => string;
  statesPath: string;
}

// us-atlas@3 is geographic lon/lat — MUST use geoAlbersUsa (not geoIdentity).
function buildTopo(topo: unknown): TopoData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = topo as any;
  const fc = feature(t, t.objects.counties) as unknown as FeatureCollection<Geometry, { name: string }>;
  const projection = geoAlbersUsa().fitSize([W, H], fc);
  const path = geoPath(projection);
  const stateBorders = mesh(t, t.objects.states, (a: unknown, b: unknown) => a !== b);
  return {
    features: fc.features,
    countyPath: (f) => path(f) ?? '',
    statesPath: path(stateBorders) ?? '',
  };
}

export default function ChoroplethMap({ counties, activeLayer, weights, visibleFips, onHover }: Props) {
  const [topo, setTopo] = useState<TopoData | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    fetch('/counties-10m.json')
      .then((r) => r.json())
      .then((j) => alive && setTopo(buildTopo(j)))
      .catch((e) => console.error('topojson load failed', e));
    return () => {
      alive = false;
    };
  }, []);

  const fills = useMemo(() => {
    if (!topo) return new Map<string, string>();
    const m = new Map<string, string>();
    for (const f of topo.features) {
      const id = String(f.id);
      const d = counties[id];
      if (!d) {
        m.set(id, colorFor(activeLayer, null));
        continue;
      }
      m.set(id, visibleFips.has(id) ? colorFor(activeLayer, layerValue(d, activeLayer, weights)) : FILTERED_OUT);
    }
    return m;
  }, [topo, counties, activeLayer, weights, visibleFips]);

  if (!topo) {
    return <div className="grid h-full place-items-center text-sm text-slate-400">Loading map…</div>;
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      onMouseLeave={() => onHover(null, 0, 0)}
    >
      <g>
        {topo.features.map((f) => {
          const id = String(f.id);
          const d = counties[id];
          return (
            <path
              key={id}
              d={topo.countyPath(f)}
              fill={fills.get(id)}
              stroke="#ffffff"
              strokeWidth={0.3}
              className="transition-[fill] duration-150 hover:stroke-slate-900 hover:[stroke-width:0.8]"
              onMouseMove={(e) => d && onHover(d, e.clientX, e.clientY)}
            />
          );
        })}
      </g>
      <path d={topo.statesPath} fill="none" stroke="#475569" strokeWidth={0.6} pointerEvents="none" />
    </svg>
  );
}
