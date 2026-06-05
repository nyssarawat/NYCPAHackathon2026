// On GitHub Pages the app is served from a repo subpath (e.g. /NYCPAHackathon2026).
// Next.js does NOT rewrite fetch() URLs — only links/imports — so we prefix manually.
// NEXT_PUBLIC_BASE_PATH is set by the Pages workflow; empty locally and on Vercel.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Resolve a /public asset path under the active base path. */
export const asset = (p: string) => `${BASE_PATH}${p}`;
