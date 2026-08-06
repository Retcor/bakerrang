import logoUrl from '../../icons/icon-48.png'

const app = document.getElementById('app')

const EYE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
const EYE_OFF_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'

const send = (type, payload) => chrome.runtime.sendMessage({ type, payload })

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

// Tiny DOM helper. `props` are assigned as element properties (className,
// textContent, type, …); children may be nodes or strings.
const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag)
  Object.assign(el, props)
  for (const c of children) el.append(c)
  return el
}

const renderLocked = (error) => {
  app.replaceChildren()
  const input = h('input', {
    type: 'password',
    placeholder: 'Master password',
    className: 'field field-with-icon',
    autocomplete: 'current-password'
  })
  const eye = h('button', { type: 'button', className: 'eye-toggle', title: 'Show password' })
  eye.innerHTML = EYE_SVG
  eye.addEventListener('click', () => {
    const reveal = input.type === 'password'
    input.type = reveal ? 'text' : 'password'
    eye.innerHTML = reveal ? EYE_OFF_SVG : EYE_SVG
    eye.title = reveal ? 'Hide password' : 'Show password'
    input.focus()
  })
  const pwWrap = h('div', { className: 'pw-wrap' }, input, eye)
  const btn = h('button', { type: 'submit', textContent: 'Unlock', className: 'btn' })
  const msg = h('p', { className: 'error', textContent: error || '' })
  const form = h('form', { className: 'unlock' },
    h('div', { className: 'brand-block' },
      h('img', { src: logoUrl, alt: '', className: 'brand-logo-lg' }),
      h('h1', { textContent: 'Unlock Vault', className: 'brand' })
    ),
    pwWrap, btn, msg
  )

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!input.value) return
    btn.disabled = true
    btn.textContent = 'Unlocking…'
    msg.textContent = ''
    const res = await send('unlock', { masterPassword: input.value })
    if (res && res.ok) {
      render()
    } else {
      btn.disabled = false
      btn.textContent = 'Unlock'
      msg.textContent = (res && res.error) || 'Unlock failed.'
      input.select()
    }
  })

  app.append(form)
  input.focus()
}

const renderUnlocked = async () => {
  app.replaceChildren()
  const tab = await getActiveTab()

  const lockBtn = h('button', { textContent: 'Lock', className: 'link' })
  lockBtn.addEventListener('click', async () => { await send('lock'); render() })
  app.append(h('div', { className: 'header' },
    h('div', { className: 'brand-wrap' },
      h('img', { src: logoUrl, alt: '', className: 'brand-logo' }),
      h('span', { textContent: 'Bakerrang Vault', className: 'brand small' })
    ),
    lockBtn
  ))

  const res = await send('matchesForTab', { url: (tab && tab.url) || '' })
  if (res && res.unlocked === false) { render(); return }
  const matches = (res && res.matches) || []

  if (!matches.length) {
    app.append(h('p', { className: 'empty', textContent: 'No saved logins for this site.' }))
  } else {
    const list = h('div', { className: 'list' })
    for (const m of matches) {
      const fillBtn = h('button', { textContent: 'Fill', className: 'btn small' })
      fillBtn.addEventListener('click', async () => {
        fillBtn.disabled = true
        fillBtn.textContent = '…'
        const r = await send('fill', { tabId: tab.id, id: m.id })
        if (r && r.ok) {
          fillBtn.textContent = 'Filled ✓'
          setTimeout(() => window.close(), 400)
        } else {
          fillBtn.disabled = false
          fillBtn.textContent = 'Fill'
          const err = h('p', { className: 'error', textContent: (r && r.error) || 'Fill failed.' })
          list.append(err)
          setTimeout(() => err.remove(), 3000)
        }
      })
      list.append(h('div', { className: 'row' },
        h('div', { className: 'info' },
          h('div', { className: 'title', textContent: m.title || '(untitled)' }),
          h('div', { className: 'sub', textContent: m.username || m.url || '' })
        ),
        fillBtn
      ))
    }
    app.append(list)
  }

  app.append(h('div', { className: 'footer' },
    h('a', {
      textContent: 'Open vault ↗',
      href: 'https://bakerrang.com/passwords',
      target: '_blank',
      className: 'link'
    })
  ))
}

const render = async () => {
  const s = await send('status')
  if (s && s.unlocked) renderUnlocked()
  else renderLocked()
}

render()
