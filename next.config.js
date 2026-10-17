/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow an isolated verification build without disturbing the active local preview.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
};

module.exports = nextConfig;
