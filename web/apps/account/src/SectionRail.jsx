import React, { useEffect, useState } from 'react'

export const SECTIONS = Object.freeze([
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'voices', label: 'Voices' },
  { id: 'session', label: 'Session' }
])

const BAR_OFFSET = 120

// The current section is the last one whose top has passed the bar; at the page bottom it is the
// last one whose top is in the upper half of the viewport (docs: DESIGN.md, Section rail).
export const currentSection = (tops, { atBottom, viewportHeight }) => {
  let current = SECTIONS[0].id
  for (const { id, top } of tops) {
    if (top <= BAR_OFFSET || (atBottom && top < viewportHeight * 0.5)) current = id
  }
  return current
}

export const SectionRail = () => {
  const [current, setCurrent] = useState(SECTIONS[0].id)

  useEffect(() => {
    let frame = 0
    const update = () => {
      const tops = SECTIONS.map(({ id }) => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top ?? Infinity }))
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      setCurrent(currentSection(tops, { atBottom, viewportHeight: window.innerHeight }))
    }
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return (
    <nav className='ac-rail' aria-label='Account sections'>
      <ul>
        {SECTIONS.map(({ id, label }) => (
          <li key={id}><a href={`#${id}`} aria-current={current === id ? 'location' : undefined}>{label}</a></li>
        ))}
      </ul>
      <p className='ac-rail__note'>Settings that belong to one app live in that app.</p>
    </nav>
  )
}
