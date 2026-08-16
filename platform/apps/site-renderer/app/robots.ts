import type { MetadataRoute } from 'next'
import { publicIndexingEnabled } from '../lib/siteUrl.ts'

export default function robots (): MetadataRoute.Robots {
  return {
    rules: publicIndexingEnabled()
      ? { userAgent: '*', allow: '/' }
      : { userAgent: '*', disallow: '/' }
  }
}
