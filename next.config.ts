import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
