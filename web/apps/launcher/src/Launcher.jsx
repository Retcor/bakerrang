import React from 'react'
import { AppFooter, AppHeader, ProductEmblem, resolveDestinations } from '@bakerrang/web-app-shell'
import { AUTH_STATUS, useAuth } from '@bakerrang/web-auth'
import { Button } from '@bakerrang/web-ui'
import logoUrl from './assets/bakerrang-logo.png'

const descriptions = Object.freeze({
  storybook: 'Write and illustrate a story with a few words, then have it read aloud.',
  polyglot: 'Speak and translate between languages, out loud, in real time.',
  sign: 'Practise ASL handshapes with your camera. Sign reads your hand on this device.',
  budget: 'Track spending against a plan without a spreadsheet.',
  wow: 'Get World of Warcraft advice tuned to your character and goals.'
})

const groups = Object.freeze([
  { title: 'Make & learn', ids: ['storybook', 'polyglot', 'sign'], large: true },
  { title: 'Manage day to day', ids: ['budget'] },
  { title: 'Play', ids: ['wow'] }
])

const Arrow = () => <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'><path d='M5 12h14M13 6l6 6-6 6' /></svg>

const ToolRow = ({ tool, large = false }) => (
  <div className={`tool-row ${large ? 'tool-row--large' : ''}`} style={{ '--accent': tool.accent }}>
    <div className='tool-row__emblem'><ProductEmblem id={tool.id} /></div>
    <div className='tool-row__copy'>
      <a className='tool-row__name' href={tool.url}>{tool.name}</a>
      <div className='tool-row__description'>{descriptions[tool.id]}</div>
    </div>
    <span className='tool-row__arrow'><Arrow /></span>
  </div>
)

const Bench = ({ tools }) => (
  <div className='bench' aria-hidden='true'>
    <div className='bench__label'><span>The bench</span><span>6 tools</span></div>
    <div className='bench__grid'>
      {tools.map((tool) => <div className='bench__cell' key={tool.id} style={{ '--accent': tool.accent }}><ProductEmblem id={tool.id} /></div>)}
    </div>
    <div className='bench__foot'><span>BakerRang</span><span>one maker · many tools</span></div>
  </div>
)

const EcosystemBand = () => (
  <section className='ecosystem' aria-label='One connected workshop'>
    <div className='ecosystem__inner'>
      <div className='ecosystem__item'>
        <div className='ecosystem__icon'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'><path d='M12 2l7 4v6c0 4-3 7-7 10-4-3-7-6-7-10V6z' /><path d='M9 12l2 2 4-4' /></svg></div>
        <div><h3>Sign in once</h3><p>Sign in with Google and every BakerRang tool already knows you — no logging in twice.</p></div>
      </div>
      <div className='ecosystem__item'>
        <div className='ecosystem__icon'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'><rect x='6' y='2' width='12' height='20' rx='2.5' /><path d='M11 18h2' /></svg></div>
        <div><h3>Install what you use</h3><p>Add a tool to your phone or desktop and it becomes its own app, with its own icon.</p></div>
      </div>
      <div className='ecosystem__item'>
        <div className='ecosystem__icon'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='9' /><path d='M12 3a9 9 0 0 0 0 18z' fill='currentColor' stroke='none' /></svg></div>
        <div><h3>Light or dark, everywhere</h3><p>Pick light, dark, or follow your system once. Your choice carries across every tool and device.</p></div>
      </div>
    </div>
  </section>
)

export const Launcher = () => {
  const auth = useAuth()
  const destinations = resolveDestinations(import.meta.env)
  const authenticated = auth.status === AUTH_STATUS.AUTHENTICATED
  const userFirstName = auth.user?.displayName?.split(/\s+/)[0] || 'there'
  const byId = new Map(destinations.tools.map((tool) => [tool.id, tool]))
  const passwords = byId.get('passwords')
  const handleLogin = auth.login

  return (
    <>
      <AppHeader logoSrc={logoUrl} destinations={destinations} />
      <main>
        <section className='hero'>
          <div className='br-wrap hero__grid'>
            <div className='hero__copy'>
              <h1 className='br-display'><span>Variety of Tools.</span><br />One Workshop.</h1>
              <p className='hero__lead'>{authenticated
                ? `Welcome back, ${userFirstName}. Pick up where you left off, or reach for a different tool — they all know you're signed in.`
                : 'BakerRang builds six focused apps — for stories, translation, signing, budgeting, game advice, and private passwords. Each is its own tool. All share one account.'}
              </p>
              <div className='hero__actions'>
                {!authenticated && <Button variant='gold' onClick={handleLogin}>Sign in with Google</Button>}
                {authenticated && <a className='br-button br-button--gold' href='#tools'>Open your tools</a>}
                <a className='hero__text-link' href='#tools'>See what's on the bench
                  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'><path d='M12 5v14M6 13l6 6 6-6' /></svg>
                </a>
              </div>
              <div className='hero__note'>
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'><rect x='6' y='2' width='12' height='20' rx='2.5' /><path d='M11 18h2' /></svg>
                One account. Install any tool to your phone as its own app.
              </div>
            </div>
            <Bench tools={destinations.tools} />
          </div>
        </section>

        <section className='tools' id='tools'>
          <div className='br-wrap'>
            <div className='tools__head'>
              <h2 className='br-display'>What's on the bench</h2>
              <p>Six tools, each built for one job. Open one — or install it on its own.</p>
            </div>

            {groups.map((group) => (
              <section className='tool-group' key={group.title}>
                <h3 className='tool-group__title'>{group.title}</h3>
                {group.ids.map((id) => <ToolRow key={id} tool={byId.get(id)} large={group.large} />)}
              </section>
            ))}

            <section className='tool-group'>
              <h3 className='tool-group__title'>Keep safe</h3>
              <a className='vault' href={passwords.url} style={{ '--accent': passwords.accent }}>
                <div className='vault__emblem'><ProductEmblem id='passwords' /></div>
                <div>
                  <div className='vault__name'>Passwords <span>Zero-knowledge</span></div>
                  <div className='vault__description'>A private vault that encrypts on your device. We store the locked bytes and never see your passwords. <b>••••••••</b></div>
                </div>
                <span className='vault__arrow'><Arrow /></span>
              </a>
            </section>

            <section className='tool-group'>
              <h3 className='tool-group__title'>Your account</h3>
              <div className='tool-row' style={{ '--accent': destinations.account.accent }}>
                <div className='tool-row__emblem'><ProductEmblem id='account' /></div>
                <div className='tool-row__copy'>
                  <a className='tool-row__name' href={destinations.account.url}>Account</a>
                  <div className='tool-row__description'>Profile, security and preferences for every BakerRang tool. Also in your avatar menu, top-right.</div>
                </div>
                <span className='tool-row__arrow'><Arrow /></span>
              </div>
            </section>
          </div>
        </section>
        <EcosystemBand />
      </main>
      <AppFooter logoSrc={logoUrl} year={2026} />
    </>
  )
}
