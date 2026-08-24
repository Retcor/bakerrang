'use client'

import { useState, type FormEvent } from 'react'
import type { SiteDefinition } from '@bakerrang/site-schema'
import { Button, StatusMessage, Textarea } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateCustomCss } from '../../lib/site'
import { WebsiteEditorShell } from './WebsiteEditorShell'

export const CUSTOM_CSS_MAX_BYTES = 20 * 1024

export const customCssByteLength = (value: string) => new TextEncoder().encode(value).byteLength

const exampleCss = `[data-br-section="hero"] h1 {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

[data-br-section="services"] [data-br-role="card"] {
  border-width: 3px;
}

@media (max-width: 640px) {
  [data-br-role="header"] {
    border-bottom-width: 4px;
  }
}`

const selectorGroups = [
  ['Site', '[data-br-site]'],
  ['Landmarks', '[data-br-role="header"]', '[data-br-role="nav"]', '[data-br-role="main"]', '[data-br-role="footer"]', '[data-br-role="social"]'],
  ['Sections', '[data-br-section="hero"]', '[data-br-section="about"]', '[data-br-section="services"]', '[data-br-section="gallery"]', '[data-br-section="testimonials"]', '[data-br-section="faq"]', '[data-br-section="businessHours"]', '[data-br-section="contact"]'],
  ['Elements', '[data-br-role="section-heading"]', '[data-br-role="card"]', '[data-br-role="button"]', '[data-br-role="form"]', '[data-br-role="input"]']
] as const

export function CustomCssEditor ({ onCancel, onDirtyChange = () => {}, onSaved, site, tenantId }: {
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const initialCss = site.customCss ?? ''
  const [css, setCss] = useState(initialCss)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const byteCount = customCssByteLength(css)
  const overLimit = byteCount > CUSTOM_CSS_MAX_BYTES
  const dirty = css !== initialCss
  const clearedLocally = dirty && css.trim() === '' && initialCss !== ''

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || overLimit || !dirty) return
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateCustomCss(tenantId, {
        customCss: css.trim() === '' ? null : css
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400
        ? caught.message
        : 'Unable to save Custom CSS. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <WebsiteEditorShell dirtyValue={css} editor="customCss" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saveDisabled={overLimit || !dirty} saving={saving} width="wide" secondaryActions={<Button disabled={saving || css === ''} onClick={() => { setCss(''); setError(null) }} type="button" variant="danger">Clear</Button>}>
      <p className="text-sm leading-6 text-fg-muted">
        Custom CSS is an advanced override for styles that Theme does not cover. Theme remains the recommended way to control colors, fonts, spacing, and standard site styling. Custom CSS can override rendered styles where the normal CSS cascade allows.
      </p>
      <p className="mt-2 text-sm leading-6 text-fg-muted">
        Saving updates Preview. If the site is already live, use Republish to update the public site. There is no live preview in this editor.
      </p>

      <div className="mt-5 min-w-0">
        <label className="text-sm font-semibold text-fg" htmlFor={`custom-css-${tenantId}`}>Custom CSS</label>
        <Textarea
          aria-describedby={`custom-css-help-${tenantId} custom-css-count-${tenantId}`}
          autoCapitalize="off"
          autoCorrect="off"
          className="mt-2 min-h-80 max-w-full whitespace-pre overflow-x-auto font-mono text-sm leading-6"
          disabled={saving}
          id={`custom-css-${tenantId}`}
          onChange={(event) => { setCss(event.target.value); setError(null) }}
          placeholder="/* Add site-scoped CSS overrides */"
          spellCheck={false}
          value={css}
          wrap="off"
        />
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-xs leading-5 text-fg-subtle" id={`custom-css-help-${tenantId}`}>UTF-8 limit: 20 KB. Whitespace and comments count toward the limit.</p>
          <p className={overLimit ? 'text-xs font-semibold text-danger-fg' : 'text-xs text-fg-subtle'} id={`custom-css-count-${tenantId}`}>
            {byteCount} bytes / 20 KB{overLimit ? ' — Limit exceeded' : ''}
          </p>
        </div>
      </div>

      {overLimit && <div className="mt-4"><StatusMessage tone="error">Custom CSS exceeds the 20 KB UTF-8 limit. Reduce it before saving.</StatusMessage></div>}
      {clearedLocally && <div className="mt-4"><StatusMessage>Cleared locally. Save Custom CSS to remove it from Preview.</StatusMessage></div>}

      <div className="mt-6 rounded-md border border-border bg-surface-muted p-4">
        <h3 className="text-sm font-semibold text-fg">Safe styling guidance</h3>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          Target BakerRang stable selectors below. Internal utility classes are not a supported styling API. Use <code className="break-words rounded bg-surface px-1 py-0.5 text-xs text-fg">data-br-section-id</code> only when a rule should target one canonical section id.
        </p>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          For visitor privacy and security, external CSS resources such as <code className="rounded bg-surface px-1 py-0.5 text-xs text-fg">@import</code>, <code className="rounded bg-surface px-1 py-0.5 text-xs text-fg">@font-face</code>, and <code className="rounded bg-surface px-1 py-0.5 text-xs text-fg">url(...)</code> are not supported. Use Media Library assets through website fields instead.
        </p>
        <details className="mt-3 min-w-0">
          <summary className="cursor-pointer text-sm font-semibold text-fg">Stable selector reference</summary>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
            {selectorGroups.map(([label, ...selectors]) => (
              <div className="min-w-0" key={label}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</h4>
                <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
                  {selectors.map((selector) => <code className="max-w-full break-all rounded bg-surface px-1.5 py-1 text-xs text-fg" key={selector}>{selector}</code>)}
                </div>
              </div>
            ))}
          </div>
        </details>
        <details className="mt-3 min-w-0">
          <summary className="cursor-pointer text-sm font-semibold text-fg">Example CSS</summary>
          <pre className="mt-3 max-w-full overflow-x-auto rounded-md bg-surface p-3 text-xs leading-5 text-fg"><code>{exampleCss}</code></pre>
        </details>
      </div>

    </WebsiteEditorShell>
  )
}
