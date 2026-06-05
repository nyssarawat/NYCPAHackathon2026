'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom';
import { feature, mesh } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { CountyDatum, CompositeWeights, Layer } from '@/lib/types';
import { layerValue } from '@/lib/score';
import { colorFor, FILTERED_OUT } from '@/lib/colorScale';
import { asset } from '@/lib/basePath';

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
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(asset('/counties-10m.json'))
      .then((r) => r.json())
      .then((j) => alive && setTopo(buildTopo(j)))
      .catch((e) => console.error('topojson load failed', e));
    return () => {
      alive = false;
    };
  }, []);

  // Bind d3-zoom once the SVG is in the DOM (after topo loads). d3-zoom handles wheel-to-cursor,
  // drag-pan, double-click, and touch; we mirror its transform into React state to render it.
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const sel = select<SVGSVGElement, unknown>(svgEl);
    const zb = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .on('zoom', (e: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const { k, x, y } = e.transform;
        setTransform({ k, x, y });
      });
    sel.call(zb);
    zoomRef.current = zb;
    return () => {
      sel.on('.zoom', null);
    };
  }, [topo]);

  const zoomBy = (factor: number) => {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomRef.current) return;
    zoomRef.current.scaleBy(select<SVGSVGElement, unknown>(svgEl), factor);
  };
  const resetZoom = () => {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomRef.current) return;
    zoomRef.current.transform(select<SVGSVGElement, unknown>(svgEl), zoomIdentity);
  };

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

  const k = transform.k;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseLeave={() => onHover(null, 0, 0)}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${k})`}>
          {topo.features.map((f) => {
            const id = String(f.id);
            const d = counties[id];
            return (
              <path
                key={id}
                d={topo.countyPath(f)}
                fill={fills.get(id)}
                stroke="#ffffff"
                strokeWidth={0.3 / k}
                className="transition-[fill] duration-150 hover:stroke-slate-900"
                onMouseMove={(e) => d && onHover(d, e.clientX, e.clientY)}
              />
            );
          })}
          <path d={topo.statesPath} fill="none" stroke="#475569" strokeWidth={0.6 / k} pointerEvents="none" />
        </g>
      </svg>

      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => zoomBy(1.5)}
          aria-label="Zoom in"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 bg-slate-900/90 text-lg leading-none text-slate-200 shadow hover:border-slate-500"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.5)}
          aria-label="Zoom out"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 bg-slate-900/90 text-lg leading-none text-slate-200 shadow hover:border-slate-500"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetZoom}
          aria-label="Reset zoom"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 bg-slate-900/90 text-[10px] uppercase leading-none text-slate-300 shadow hover:border-slate-500"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
