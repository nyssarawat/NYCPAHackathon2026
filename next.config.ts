import type { NextConfig } from "next";

// Empty locally / on Vercel; set to "/NYCPAHackathon2026" by the GitHub Pages workflow.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export", // static HTML export for GitHub Pages (no server runtime needed)
  basePath,
  images: { unoptimized: true }, // required by static export
  // Pin the workspace root — stray lockfiles in parent dirs confuse Turbopack's inference.
  turbopack: { root: __dirname },

  // 1. Force Next.js to output static HTML/CSS/JS files into an "out" folder
  output: 'export', 
  
  // 2. Set the sub-directory path matching your exact GitHub repository name
  basePath: '/NYCPALymeHackathon2026',
  
  // 3. Disable the default server-side image optimization (unsupported by GitHub Pages)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
