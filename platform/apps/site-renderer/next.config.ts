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
  ]
}

export default nextConfig
