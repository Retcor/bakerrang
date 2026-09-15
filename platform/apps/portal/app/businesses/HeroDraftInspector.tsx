'use client'

import type { HeroContent, HeroSection } from '@bakerrang/site-schema'
import { Input, Textarea } from '@bakerrang/ui'

/**
 * Phase 4.0b's only draft-native inspector. The CTA destination intentionally
 * remains the runtime-derived Contact-section anchor; it is not Hero data.
 */
export function HeroDraftInspector ({ hero, onChange, saving }: {
  hero: HeroSection
  onChange: (content: HeroContent) => void
  saving: boolean
}) {
  const update = (patch: Partial<HeroContent>) => onChange({ ...hero.content, ...patch })
  return (
    <section aria-label="Hero properties" className="border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-8 place-items-center rounded-md bg-surface-muted text-sm font-bold text-fg">H</span>
        <div><h2 className="text-base font-semibold tracking-tight text-fg">Hero</h2><p className="text-xs text-fg-subtle">The first message visitors see.</p></div>
      </div>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-semibold text-fg" htmlFor={`hero-title-${hero.id}`}>Headline
          <Input className="mt-2" disabled={saving} id={`hero-title-${hero.id}`} maxLength={200} onChange={(event) => update({ title: event.target.value })} value={hero.content.title} />
        </label>
        <label className="block text-sm font-semibold text-fg" htmlFor={`hero-subtitle-${hero.id}`}>Subheading
          <Textarea className="mt-2" disabled={saving} id={`hero-subtitle-${hero.id}`} maxLength={500} onChange={(event) => update({ subtitle: event.target.value })} value={hero.content.subtitle ?? ''} />
        </label>
        <label className="block text-sm font-semibold text-fg" htmlFor={`hero-cta-${hero.id}`}>CTA label
          <Input className="mt-2" disabled={saving} id={`hero-cta-${hero.id}`} maxLength={60} onChange={(event) => update({ ctaLabel: event.target.value })} value={hero.content.ctaLabel ?? ''} />
        </label>
        <p className="text-xs leading-5 text-fg-subtle">The CTA continues to take visitors to this page’s Contact section.</p>
      </div>
    </section>
  )
}
