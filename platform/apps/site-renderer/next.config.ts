import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@bakerrang/site-components',
    '@bakerrang/ui',
    '@bakerrang/site-schema'
  ]
}

export default nextConfig
