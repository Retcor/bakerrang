'use client'

import { useEffect } from 'react'

export function PreviewQueryPreserver ({ tenantId, token }: {
  tenantId: string
  token: string
}) {
  useEffect(() => {
    const previewRoot = `/preview/${encodeURIComponent(tenantId)}`
    const preserveToken = () => {
      for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        const url = new URL(anchor.href, window.location.href)
        if (url.origin !== window.location.origin) continue
        if (url.pathname !== previewRoot && !url.pathname.startsWith(`${previewRoot}/`)) continue
        url.searchParams.set('token', token)
        anchor.href = `${url.pathname}${url.search}${url.hash}`
      }
    }
    preserveToken()
    document.addEventListener('focusin', preserveToken)
    return () => document.removeEventListener('focusin', preserveToken)
  }, [tenantId, token])
  return null
}
