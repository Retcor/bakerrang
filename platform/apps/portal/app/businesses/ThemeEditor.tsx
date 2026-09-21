'use client'

import { useEffect, useState, type FormEvent } from 'react'
import type {
  ContentWidth,
  CornerStyle,
  SectionSpacing,
  SiteDefinition,
  SiteFont,
  SiteTheme
} from '@bakerrang/site-schema'
import { Button, ConfirmDialog, Field, Select } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSiteTheme } from '../../lib/site'
import {
  DEFAULT_SITE_THEME,
  previewForeground,
  SITE_FONT_OPTIONS,
  themeColorContrast
} from '../../lib/theme'
import { cloneTheme, THEME_PRESETS, type ThemePreset } from '../../lib/themePresets'
import { type ActiveEditorController, WebsiteEditorShell } from './WebsiteEditorShell'
import { SegmentedControl } from './WebsiteToolPrimitives'

const HEX = /^#[0-9a-f]{6}$/i
const colorFields = [
  ['primary', 'Primary'], ['accent', 'Accent'], ['background', 'Background'], ['text', 'Text']
] as const
const fontFamily = (font: SiteFont) => SITE_FONT_OPTIONS.find((option) => option.value === font)?.family

export function ThemeEditor ({ chrome, onBack, onCancel, onControllerChange, onDirtyChange = () => {}, onLivePreview, onSaved, site, tenantId }: {
  chrome?: 'card' | 'rail'
  onBack?: () => void
  onCancel: () => void
  onControllerChange?: (controller: ActiveEditorController | null) => void
  onDirtyChange?: (dirty: boolean) => void
  onLivePreview?: (patch: Pick<SiteDefinition, 'theme'>) => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const [theme, setTheme] = useState<SiteTheme>(site.theme)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingPreset, setPendingPreset] = useState<ThemePreset | 'reset' | null>(null)

  const setColor = (key: keyof SiteTheme['colors'], value: string) => {
    setTheme((current) => ({ ...current, colors: { ...current.colors, [key]: value } }))
  }
  const contrast = themeColorContrast(theme.colors.text, theme.colors.background)
  const lowContrast = contrast !== null && contrast < 4.5
  const radius = theme.cornerStyle === 'rounded' ? '1rem' : theme.cornerStyle === 'soft' ? '0.75rem' : '0'
  const dirty = JSON.stringify(theme) !== JSON.stringify(site.theme)

  useEffect(() => {
    onLivePreview?.({ theme })
  }, [onLivePreview, theme])

  const applyTheme = (next: SiteTheme) => {
    setTheme(cloneTheme(next))
    setError(null)
    setPendingPreset(null)
  }
  const requestTheme = (preset: ThemePreset | 'reset') => {
    if (saving) return
    if (dirty) setPendingPreset(preset)
    else applyTheme(preset === 'reset' ? DEFAULT_SITE_THEME : preset.theme)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (Object.values(theme.colors).some((value) => !HEX.test(value))) {
      setError('Colors must use the #RRGGBB format.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateSiteTheme(tenantId, {
        ...theme,
        colors: Object.fromEntries(Object.entries(theme.colors).map(([key, value]) => [key, value.toLowerCase()])) as SiteTheme['colors']
      }))
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 400
        ? caught.message
        : 'Unable to save the Theme. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <WebsiteEditorShell chrome={chrome} dirtyValue={theme} editor="theme" error={error} onBack={onBack} onCancel={onCancel} onControllerChange={onControllerChange} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saving={saving} secondaryActions={<Button disabled={saving} onClick={() => requestTheme('reset')} type="button" variant="ghost">Reset to defaults</Button>}>
      <section aria-labelledby={`theme-presets-${tenantId}`}>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle" id={`theme-presets-${tenantId}`}>Start from a preset</h3>
        <p className="mt-1 text-sm leading-6 text-fg-muted">Presets fill this local form. Customize anything, then save when you are ready.</p>
        <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface">
          {THEME_PRESETS.map((preset) => (
            <button aria-label={`Apply ${preset.name}`} className="flex min-h-[3.625rem] w-full items-center gap-3 border-b border-border px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60" data-testid="theme-preset-row" disabled={saving} key={preset.name} onClick={() => requestTheme(preset)} type="button">
              <span aria-label={`${preset.name} colors`} className="flex shrink-0 overflow-hidden rounded border border-border" title={[preset.theme.colors.primary, preset.theme.colors.accent, preset.theme.colors.background].join(', ')}>{[preset.theme.colors.primary, preset.theme.colors.accent, preset.theme.colors.background].map((color) => <span className="h-7 w-3" key={color} style={{ backgroundColor: color }} />)}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-fg">{preset.name}</span><span className="mt-0.5 block truncate text-xs text-fg-subtle">{SITE_FONT_OPTIONS.find((option) => option.value === preset.theme.headingFont)?.label} + {SITE_FONT_OPTIONS.find((option) => option.value === preset.theme.bodyFont)?.label}</span></span>
              <span className="shrink-0 text-xs font-semibold text-fg-muted">Apply</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby={`theme-colours-${tenantId}`}>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle" id={`theme-colours-${tenantId}`}>Colours</h3>
        <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface" data-testid="theme-colour-rows">
          {colorFields.map(([key, label]) => {
            const value = theme.colors[key]
            const valid = HEX.test(value) ? value : DEFAULT_SITE_THEME.colors[key]
            return (
              <div className="flex min-h-[3.25rem] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0" key={key}>
                <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border-strong shadow-xs" style={{ backgroundColor: valid }}><span className="sr-only">{label} color picker</span><input aria-label={`${label} color picker`} className="absolute inset-0 size-full cursor-pointer opacity-0" disabled={saving} onChange={(event) => setColor(key, event.target.value)} type="color" value={valid} /></label>
                <label className="min-w-0 flex-1 text-sm font-medium text-fg" htmlFor={`theme-${key}-${tenantId}`}>{label}</label>
                <input aria-label={`${label} color hex`} className="h-9 w-24 rounded-md border border-border-strong bg-surface px-2 text-right text-sm font-medium tabular-nums text-fg outline-none transition focus:border-focus focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} id={`theme-${key}-${tenantId}`} maxLength={7} onChange={(event) => setColor(key, event.target.value)} value={value} />
              </div>
            )
          })}
        </div>
        {lowContrast && <p className="mt-3 text-sm text-warning-fg" role="status">This text may be difficult to read on the selected background.</p>}
      </section>

      <section className="mt-6" aria-labelledby={`theme-typography-${tenantId}`}>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle" id={`theme-typography-${tenantId}`}>Typography</h3>
        <div className="mt-3 grid gap-4">
        <Field id={`heading-font-${tenantId}`} label="Heading font">
          <Select className="mt-2" disabled={saving} onChange={(event) => setTheme((current) => ({ ...current, headingFont: event.target.value as SiteFont }))} value={theme.headingFont}>
            {SITE_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>
        <Field id={`body-font-${tenantId}`} label="Body font">
          <Select className="mt-2" disabled={saving} onChange={(event) => setTheme((current) => ({ ...current, bodyFont: event.target.value as SiteFont }))} value={theme.bodyFont}>
            {SITE_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>
        </div>
      </section>

      <ThemeChoices<CornerStyle> disabled={saving} label="Corner style" onChange={(cornerStyle) => setTheme((current) => ({ ...current, cornerStyle }))} options={['rounded', 'soft', 'square']} value={theme.cornerStyle} />
      <p className="mt-2 text-sm text-fg-muted">Controls the corner treatment across site buttons, inputs, cards, and panels.</p>
      <ThemeChoices<ContentWidth> disabled={saving} label="Content width" onChange={(contentWidth) => setTheme((current) => ({ ...current, contentWidth }))} options={['narrow', 'standard', 'wide']} value={theme.contentWidth} />
      <ThemeChoices<SectionSpacing> disabled={saving} label="Section spacing" onChange={(sectionSpacing) => setTheme((current) => ({ ...current, sectionSpacing }))} options={['compact', 'comfortable', 'spacious']} value={theme.sectionSpacing} />

      <section aria-label="Theme sample" className="mt-6">
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle">Preview</h3>
        <div className="mt-3 border p-4" style={{
        backgroundColor: HEX.test(theme.colors.background) ? theme.colors.background : DEFAULT_SITE_THEME.colors.background,
        borderColor: HEX.test(theme.colors.accent) ? theme.colors.accent : DEFAULT_SITE_THEME.colors.accent,
        borderRadius: radius,
        color: HEX.test(theme.colors.text) ? theme.colors.text : DEFAULT_SITE_THEME.colors.text,
        fontFamily: fontFamily(theme.bodyFont)
      }}>
        <h4 className="text-xl font-semibold" style={{ fontFamily: fontFamily(theme.headingFont) }}>Your website Theme</h4>
        <p className="mt-2 text-sm">A quick local sample of typography, colors, and corner treatment.</p>
        <span className="mt-4 inline-flex px-4 py-2 text-sm font-semibold" style={{
          backgroundColor: HEX.test(theme.colors.primary) ? theme.colors.primary : DEFAULT_SITE_THEME.colors.primary,
          borderRadius: theme.cornerStyle === 'rounded' ? '0.75rem' : theme.cornerStyle === 'soft' ? '0.375rem' : '0',
          color: previewForeground(HEX.test(theme.colors.primary) ? theme.colors.primary : DEFAULT_SITE_THEME.colors.primary)
        }}>Primary action</span>
        <span className="ml-2 mt-4 inline-flex px-4 py-2 text-sm font-semibold" style={{
          backgroundColor: HEX.test(theme.colors.accent) ? theme.colors.accent : DEFAULT_SITE_THEME.colors.accent,
          borderRadius: theme.cornerStyle === 'rounded' ? '0.75rem' : theme.cornerStyle === 'soft' ? '0.375rem' : '0',
          color: previewForeground(HEX.test(theme.colors.accent) ? theme.colors.accent : DEFAULT_SITE_THEME.colors.accent)
        }}>Accent</span>
        </div>
      </section>

    </WebsiteEditorShell>
    <ConfirmDialog cancelLabel="Keep editing" confirmLabel={pendingPreset === 'reset' ? 'Reset form' : 'Apply preset'} description={pendingPreset === 'reset' ? 'This will replace your unsaved Theme choices. You can continue editing before saving.' : `This will replace your unsaved Theme choices with ${pendingPreset?.name ?? 'this'} theme. You can continue editing before saving.`} onCancel={() => setPendingPreset(null)} onConfirm={() => { if (pendingPreset) applyTheme(pendingPreset === 'reset' ? DEFAULT_SITE_THEME : pendingPreset.theme) }} open={pendingPreset !== null} title={pendingPreset === 'reset' ? 'Reset Theme defaults?' : `Apply ${pendingPreset?.name ?? ''} theme?`} />
    </>
  )
}

function ThemeChoices<T extends string> ({ disabled, label, onChange, options, value }: {
  disabled: boolean
  label: string
  onChange: (value: T) => void
  options: readonly T[]
  value: T
}) {
  return (
    <fieldset className="mt-6">
      <legend className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-fg-subtle">{label}</legend>
      <div className="mt-3"><SegmentedControl ariaLabel={label} disabled={disabled} onChange={onChange} options={options.map((option) => ({ value: option, label: option === 'workSans' ? 'Work Sans' : option }))} value={value} /></div>
    </fieldset>
  )
}
