import { Hero } from '@bakerrang/site-components'

export default function SiteRendererPage () {
  return (
    <main>
      <Hero
        content={{
          title: 'A reusable foundation for a clear local presence.',
          subtitle: 'This static demo proves shared marketing components, schema types, and semantic styles work together.',
          ctaLabel: 'Get started'
        }}
      />
    </main>
  )
}
