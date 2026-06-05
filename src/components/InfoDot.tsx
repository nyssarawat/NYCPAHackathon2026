'use client';

import { useState } from 'react';

/**
 * A small ⓘ affordance with an immediate hover tooltip. Uses a position:fixed bubble anchored to
 * the dot via getBoundingClientRect so it escapes the sidebar's `overflow-y-auto` clipping (an
 * absolutely-positioned tooltip would be cut off). Mirrors the fixed-position CountyHoverCard pattern.
 */
export default function InfoDot({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      className="ml-1 inline-flex cursor-help align-middle text-slate-500 hover:text-slate-300"
      role="img"
      aria-label={text}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top });
      }}
      onMouseLeave={() => setPos(null)}
    >
      ⓘ
      {pos && (
        <span
          className="pointer-events-none fixed z-[60] w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-slate-200 shadow-xl"
          style={{ left: pos.x, top: pos.y - 8 }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
