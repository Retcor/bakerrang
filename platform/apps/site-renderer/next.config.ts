import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  allowedDevOrigins: ['custom-dev.bakerrang.com'],
  transpilePackages: [
    '@bakerrang/site-components',
    '@bakerrang/ui',
    '@bakerrang/site-schema'
  ],
  async headers () {
    return [{
      source: '/preview/:path*',
      headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
      ]
    }]
  }
}

export default nextConfig
