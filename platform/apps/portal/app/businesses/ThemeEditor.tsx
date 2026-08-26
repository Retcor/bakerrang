'use client'

import { useState, type FormEvent } from 'react'
import type {
  ContentWidth,
  CornerStyle,
  SectionSpacing,
  SiteDefinition,
  SiteFont,
  SiteTheme
} from '@bakerrang/site-schema'
import { Button, Field, Input, Select } from '@bakerrang/ui'
import { ApiError } from '../../lib/api'
import { updateSiteTheme } from '../../lib/site'
import {
  DEFAULT_SITE_THEME,
  previewForeground,
  SITE_FONT_OPTIONS,
  themeColorContrast
} from '../../lib/theme'
import { WebsiteEditorShell } from './WebsiteEditorShell'

const HEX = /^#[0-9a-f]{6}$/i
const colorFields = [
  ['primary', 'Primary'], ['accent', 'Accent'], ['background', 'Background'], ['text', 'Text']
] as const
const fontFamily = (font: SiteFont) => SITE_FONT_OPTIONS.find((option) => option.value === font)?.family

export function ThemeEditor ({ onCancel, onDirtyChange = () => {}, onSaved, site, tenantId }: {
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSaved: (site: SiteDefinition) => void
  site: SiteDefinition
  tenantId: string
}) {
  const [theme, setTheme] = useState<SiteTheme>(site.theme)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setColor = (key: keyof SiteTheme['colors'], value: string) => {
    setTheme((current) => ({ ...current, colors: { ...current.colors, [key]: value } }))
  }
  const contrast = themeColorContrast(theme.colors.text, theme.colors.background)
  const lowContrast = contrast !== null && contrast < 4.5
  const radius = theme.cornerStyle === 'rounded' ? '1rem' : theme.cornerStyle === 'soft' ? '0.75rem' : '0'

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
    <WebsiteEditorShell dirtyValue={theme} editor="theme" error={error} onCancel={onCancel} onDirtyChange={onDirtyChange} onSubmit={(event) => void submit(event)} saving={saving} secondaryActions={<Button disabled={saving} onClick={() => { setTheme(DEFAULT_SITE_THEME); setError(null) }} type="button" variant="ghost">Reset to defaults</Button>}>
      <p className="text-sm leading-6 text-fg-muted">Save, then use Preview to review the actual website before republishing.</p>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-fg">Colors</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {colorFields.map(([key, label]) => {
            const value = theme.colors[key]
            const valid = HEX.test(value) ? value : DEFAULT_SITE_THEME.colors[key]
            const id = `theme-${key}-${tenantId}`
            return (
              <Field id={id} key={key} label={`${label} color`}>
                <div className="mt-2 flex gap-2">
                  <input aria-label={`${label} color picker`} className="h-11 w-14 shrink-0 rounded-md border border-border-strong bg-surface p-1" disabled={saving} onChange={(event) => setColor(key, event.target.value)} type="color" value={valid} />
                  <Input aria-label={`${label} color hex`} disabled={saving} maxLength={7} onChange={(event) => setColor(key, event.target.value)} value={value} />
                </div>
              </Field>
            )
          })}
        </div>
        {lowContrast && <p className="mt-3 text-sm text-warning-fg" role="status">This text may be difficult to read on the selected background.</p>}
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

      <ThemeChoices<CornerStyle> disabled={saving} label="Corner style" name="cornerStyle" onChange={(cornerStyle) => setTheme((current) => ({ ...current, cornerStyle }))} options={['rounded', 'soft', 'square']} value={theme.cornerStyle} />
      <p className="mt-2 text-sm text-fg-muted">Controls the corner treatment across site buttons, inputs, cards, and panels.</p>
      <ThemeChoices<ContentWidth> disabled={saving} label="Content width" name="contentWidth" onChange={(contentWidth) => setTheme((current) => ({ ...current, contentWidth }))} options={['narrow', 'standard', 'wide']} value={theme.contentWidth} />
      <ThemeChoices<SectionSpacing> disabled={saving} label="Section spacing" name="sectionSpacing" onChange={(sectionSpacing) => setTheme((current) => ({ ...current, sectionSpacing }))} options={['compact', 'comfortable', 'spacious']} value={theme.sectionSpacing} />

      <section aria-label="Theme sample" className="mt-6 border p-5" style={{
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
      </section>

    </WebsiteEditorShell>
  )
}

function ThemeChoices<T extends string> ({ disabled, label, name, onChange, options, value }: {
  disabled: boolean
  label: string
  name: string
  onChange: (value: T) => void
  options: readonly T[]
  value: T
}) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-semibold text-fg">{label}</legend>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <label className={`flex min-h-11 items-center justify-center rounded-md border px-3 py-2 text-center text-sm font-medium capitalize ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${value === option ? 'border-focus bg-surface-muted text-fg' : 'border-border-strong bg-surface text-fg-muted'}`} key={option}>
            <input checked={value === option} className="sr-only" disabled={disabled} name={name} onChange={() => onChange(option)} type="radio" value={option} />
            {option === 'workSans' ? 'Work Sans' : option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
