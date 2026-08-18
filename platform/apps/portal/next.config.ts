import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@bakerrang/site-schema', '@bakerrang/ui'],
  env: {
    NEXT_PUBLIC_CUSTOM_DOMAIN_IPV4_ADDRESS: process.env.CUSTOM_DOMAIN_IPV4_ADDRESS,
    NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET: process.env.CUSTOM_DOMAIN_CNAME_TARGET
  }
}

export default nextConfig
