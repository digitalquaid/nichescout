/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // We still lint in CI; don't fail Vercel builds on lint warnings.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
