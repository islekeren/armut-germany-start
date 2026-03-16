/* global process */
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();
const apiOrigin =
  process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/ui', '@repo/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
