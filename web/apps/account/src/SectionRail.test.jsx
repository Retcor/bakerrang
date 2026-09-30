// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SectionRail, currentSection } from './SectionRail.jsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const tops = (profile, appearance, voices, session) => [
  { id: 'profile', top: profile }, { id: 'appearance', top: appearance }, { id: 'voices', top: voices }, { id: 'session', top: session }
]
const viewport = { atBottom: false, viewportHeight: 900 }

describe('current section rule', () => {
  it('is the last section whose top has passed the bar', () => {
    expect(currentSection(tops(200, 700, 1200, 1800), viewport)).toBe('profile')
    expect(currentSection(tops(-50, 118, 700, 1300), viewport)).toBe('appearance')
    expect(currentSection(tops(-900, -500, -20, 500), viewport)).toBe('voices')
  })

  it('at the page bottom is the last section whose top is in the upper half of the viewport', () => {
    expect(currentSection(tops(-1500, -1100, 100, 430), { atBottom: true, viewportHeight: 900 })).toBe('session')
    expect(currentSection(tops(-1500, -1100, 100, 600), { atBottom: true, viewportHeight: 900 })).toBe('voices')
  })
})

describe('rail', () => {
  it('links to the four sections by fragment and follows the scroll', async () => {
    const positions = { profile: 300, appearance: 800, voices: 1300, session: 1900 }
    ;['profile', 'appearance', 'voices', 'session'].forEach((id) => {
      const element = document.createElement('section')
      element.id = id
      document.body.appendChild(element)
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return { top: positions[this.id] ?? 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }
    })
    render(<SectionRail />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#profile', '#appearance', '#voices', '#session'])
    const current = () => links.filter((link) => link.getAttribute('aria-current') === 'location').map((link) => link.textContent)
    expect(current()).toEqual(['Profile'])

    positions.profile = -700; positions.appearance = -200; positions.voices = 90; positions.session = 700
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(current()).toEqual(['Voices'])
    document.body.replaceChildren()
  })
})

describe('Relay ground values track the shared tokens', () => {
  const tokens = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/web-tokens/src/tokens.css'), 'utf8')
  const css = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'styles/account.css'), 'utf8')
  const block = (source, selector) => source.slice(source.indexOf(selector), source.indexOf('}', source.indexOf(selector)))
  const value = (source, name) => new RegExp(`${name}:\\s*([^;]+);`).exec(source)[1].trim()
  const normalize = (text) => text.replaceAll(/\s+/g, '').toLowerCase()

  it('has the dark tile ground equal to the dark tokens and the light tile ground equal to the light tokens', () => {
    const dark = block(tokens, ':root {')
    const light = block(tokens, ':root[data-theme="light"]')
    const tileDark = block(css, '.ac-relay li {')
    const tileLight = block(css, '.ac-relay li[data-ground="light"]')
    const pairs = [['--tile-plane', '--plane'], ['--tile-line', '--line'], ['--tile-ink', '--ink'], ['--tile-story', '--accent-story'], ['--tile-polyglot', '--accent-polyglot'], ['--tile-sign', '--accent-sign'], ['--tile-budget', '--accent-budget'], ['--tile-passwords', '--accent-passwords']]
    for (const [tile, token] of pairs) {
      expect(normalize(value(tileDark, tile)), `dark ${tile}`).toBe(normalize(value(dark, token)))
      expect(normalize(value(tileLight, tile)), `light ${tile}`).toBe(normalize(value(light, token)))
    }
  })
})
