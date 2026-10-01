import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['http://172.19.160.1:3000', 'http://localhost:3000'],
};

export default nextConfig;
