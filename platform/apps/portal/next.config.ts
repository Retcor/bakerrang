import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@bakerrang/site-schema', '@bakerrang/ui']
}

export default nextConfig
