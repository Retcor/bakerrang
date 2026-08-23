import type { ReactNode } from 'react'
import { PreviewQueryPreserver } from './PreviewQueryPreserver'

export function PreviewFrame ({ children, tenantId, token }: {
  children: ReactNode
  tenantId: string
  token: string
}) {
  return (
    <div data-preview-frame="">
      <div className="sticky top-0 z-50 flex min-h-11 items-center justify-center bg-amber-300 px-4 py-2 text-center text-sm font-bold text-neutral-900 shadow-sm" data-preview-banner="" role="status">
        Preview — not published
      </div>
      <PreviewQueryPreserver tenantId={tenantId} token={token} />
      <div className="relative z-0 isolate" data-preview-site-layer="">
        {children}
      </div>
    </div>
  )
}
