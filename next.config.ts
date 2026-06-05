import type { NextConfig } from "next";

// Empty locally / on Vercel; set to "/NYCPAHackathon2026" by the GitHub Pages workflow.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export", // static HTML export for GitHub Pages (no server runtime needed)
  basePath,
  images: { unoptimized: true }, // required by static export
  // Pin the workspace root — stray lockfiles in parent dirs confuse Turbopack's inference.
  turbopack: { root: __dirname },
};

export default nextConfig;
