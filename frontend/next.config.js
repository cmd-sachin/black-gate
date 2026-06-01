/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8001';

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/soc/:path*',
        destination: `${BACKEND_URL}/soc/:path*`,
      },
      {
        source: '/incidents',
        destination: `${BACKEND_URL}/incidents`,
      },
      {
        source: '/agent/:path*',
        destination: `${BACKEND_URL}/agent/:path*`,
      }
    ];
  },
};

module.exports = nextConfig;