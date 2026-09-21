import type { SiteFont } from '@bakerrang/site-schema'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SITE_FONT_OPTIONS } from '../../lib/theme'

const fontLoaders = vi.hoisted(() => {
  const loader = () => vi.fn(({ variable }: { variable: string }) => ({ variable: `class-${variable.slice(2)}` }))
  return {
    Inter: loader(),
    Lora: loader(),
    Merriweather: loader(),
    Montserrat: loader(),
    Playfair_Display: loader(),
    Poppins: loader(),
    Source_Serif_4: loader(),
    Work_Sans: loader()
  }
})

vi.mock('next/font/google', () => fontLoaders)

import SitePreviewFrameLayout from './layout'

const variableClassBySiteFont: Record<SiteFont, string> = {
  inter: 'class-font-site-inter',
  poppins: 'class-font-site-poppins',
  montserrat: 'class-font-site-montserrat',
  workSans: 'class-font-site-work-sans',
  lora: 'class-font-site-lora',
  merriweather: 'class-font-site-merriweather',
  playfair: 'class-font-site-playfair',
  sourceSerif: 'class-font-site-source-serif'
}

describe('site preview frame layout', () => {
  it('exposes every configured site-font variable class to preview descendants', () => {
    render(<SitePreviewFrameLayout><span>Preview content</span></SitePreviewFrameLayout>)

    const wrapper = screen.getByText('Preview content').parentElement
    expect(wrapper?.tagName).toBe('DIV')
    expect(wrapper?.className.split(' ')).toEqual(Object.values(variableClassBySiteFont))
    expect(wrapper).toHaveStyle({ minHeight: '100%' })
    expect(Object.keys(variableClassBySiteFont).sort()).toEqual(SITE_FONT_OPTIONS.map((option) => option.value).sort())
  })

  it('mirrors the public renderer font loader configuration', () => {
    const sharedOptions = { subsets: ['latin'], display: 'swap', preload: false }
    expect(fontLoaders.Inter).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-inter' })
    expect(fontLoaders.Poppins).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-poppins', weight: ['400', '600', '700'] })
    expect(fontLoaders.Montserrat).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-montserrat' })
    expect(fontLoaders.Work_Sans).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-work-sans' })
    expect(fontLoaders.Lora).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-lora' })
    expect(fontLoaders.Merriweather).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-merriweather' })
    expect(fontLoaders.Playfair_Display).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-playfair' })
    expect(fontLoaders.Source_Serif_4).toHaveBeenCalledWith({ ...sharedOptions, variable: '--font-site-source-serif' })
  })
})
