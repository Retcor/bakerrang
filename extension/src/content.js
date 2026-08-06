// Runs on every page but stays passive: it only acts when the background sends a
// `fill` message (triggered by the user clicking Fill in the popup). It finds the
// login fields and writes the credentials, simulating a real edit so that
// framework-controlled inputs (React/Angular) and autofill-hardened bank fields
// register the value.

// Set the value through the native setter (bypasses React's value tracker) and
// fire the full edit event sequence — focus + keydown/input/keyup/change — so a
// framework reading el.value on any of those events picks the new value up.
const setNativeValue = (el, value) => {
  const proto = el instanceof window.HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  try { el.focus() } catch {}
  if (setter) setter.call(el, value)
  else el.value = value
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

const isVisible = (el) => {
  if (el.disabled || el.readOnly) return false
  if (el.offsetParent !== null) return true
  return el.getClientRects().length > 0
}

const looksLikeUsername = (el) =>
  /user|email|login|account/i.test(`${el.name} ${el.id} ${el.autocomplete} ${el.getAttribute('aria-label') || ''}`)

// Find the first visible password field and its most likely username field
// (nearest visible text/email input before it; falls back to name/id hints).
const findFields = () => {
  const inputs = Array.from(document.querySelectorAll('input')).filter(isVisible)
  const pw = inputs.find((el) => (el.type || '').toLowerCase() === 'password') || null

  let user = null
  if (pw) {
    const pwIdx = inputs.indexOf(pw)
    for (let i = pwIdx - 1; i >= 0; i--) {
      const t = (inputs[i].type || 'text').toLowerCase()
      if (t === 'text' || t === 'email' || t === 'tel') { user = inputs[i]; break }
    }
    if (!user) user = inputs.find(looksLikeUsername) || null
  } else {
    // No password field (e.g. a two-step username-first form) — fill username only.
    user = inputs.find(looksLikeUsername) ||
      inputs.find((el) => ['email', 'text'].includes((el.type || '').toLowerCase())) || null
  }
  return { user, pw }
}

const fillCredentials = ({ username, password }) => {
  const { user, pw } = findFields()
  let filled = false
  if (user && username) { setNativeValue(user, username); filled = true }
  if (pw && password) { setNativeValue(pw, password); filled = true }

  // Some autofill-hardened fields (e.g. Citi's #userId) re-sync from their
  // framework model right after the first programmatic set, blanking the value.
  // A corrective pass shortly after re-applies it only where it didn't stick.
  if (filled) {
    setTimeout(() => {
      if (user && username && user.value !== username) setNativeValue(user, username)
      if (pw && password && pw.value !== password) setNativeValue(pw, password)
    }, 150)
  }
  return filled
}

// The fill message is broadcast to every frame (top + all iframes). To avoid the
// empty top frame winning the response race and reporting failure, a frame stays
// silent unless it actually filled — so the promise in the background resolves
// with the *filling* frame's { ok: true }, and rejects only if no frame filled.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'fill') {
    if (fillCredentials(msg.payload || {})) sendResponse({ ok: true })
    // else: no fields in this frame — do not respond
  }
  return false
})

// ---------- Inline autofill (a key icon inside login fields, click to fill) ----------
// Opt-in via the server-synced `inlineAutofill` setting. On focus of a login
// field the background is asked for matches (metadata only); if any, a small key
// icon is shown over the field. Clicking it fills (or shows a chooser for
// multiples) via `fillHere`, which sends the credential back to this exact frame.

const ICON_SIZE = 22
const KEY_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M13.5 11.5L22 3"/><path d="M17 7l3 3"/></svg>'

let overlay = null // the key icon button
let chooser = null // dropdown of matches (when > 1)
let anchorEl = null // the field the icon is attached to
let currentMatches = []
let focusToken = 0 // guards against focus moving while we await matches

const removeChooser = () => { if (chooser) { chooser.remove(); chooser = null } }

const removeOverlay = () => {
  if (overlay) { overlay.remove(); overlay = null }
  removeChooser()
  anchorEl = null
  currentMatches = []
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition, true)
}

const positionChooser = (rect) => {
  if (!chooser) return
  chooser.style.top = `${window.scrollY + rect.bottom + 4}px`
  chooser.style.left = `${window.scrollX + Math.max(8, rect.right - 260)}px`
}

const reposition = () => {
  if (!overlay || !anchorEl) return
  if (!anchorEl.isConnected) { removeOverlay(); return }
  const r = anchorEl.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) { removeOverlay(); return }
  overlay.style.top = `${window.scrollY + r.top + (r.height - ICON_SIZE) / 2}px`
  overlay.style.left = `${window.scrollX + r.right - ICON_SIZE - 6}px`
  positionChooser(r)
}

const chooseMatch = async (m) => {
  removeOverlay()
  try { await chrome.runtime.sendMessage({ type: 'fillHere', payload: { id: m.id } }) } catch {}
}

const showChooser = () => {
  removeChooser()
  if (!anchorEl || currentMatches.length <= 1) return
  chooser = document.createElement('div')
  Object.assign(chooser.style, {
    position: 'absolute', zIndex: 2147483647, minWidth: '200px', maxWidth: '260px',
    background: '#ffffff', color: '#1a1a2e', border: '1px solid #e5e7eb',
    borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', padding: '4px', overflow: 'hidden'
  })
  currentMatches.forEach((m) => {
    const row = document.createElement('button')
    row.type = 'button'
    Object.assign(row.style, {
      display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
      border: 'none', background: 'transparent', borderRadius: '6px', cursor: 'pointer', font: '13px system-ui, sans-serif'
    })
    row.onmouseenter = () => { row.style.background = '#f1f1f7' }
    row.onmouseleave = () => { row.style.background = 'transparent' }
    const title = document.createElement('div')
    title.textContent = m.title || '(untitled)'
    title.style.fontWeight = '600'
    const sub = document.createElement('div')
    sub.textContent = m.username || ''
    Object.assign(sub.style, { fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })
    row.append(title, sub)
    // mousedown (not click) so it fires before the field's blur tears us down.
    row.addEventListener('mousedown', (e) => { e.preventDefault(); chooseMatch(m) })
    chooser.appendChild(row)
  })
  document.body.appendChild(chooser)
  positionChooser(anchorEl.getBoundingClientRect())
}

const onIconClick = (e) => {
  e.preventDefault()
  e.stopPropagation()
  if (currentMatches.length === 1) chooseMatch(currentMatches[0])
  else showChooser()
}

const showOverlayFor = (el, matches) => {
  if (!document.body) return
  removeOverlay()
  anchorEl = el
  currentMatches = matches
  overlay = document.createElement('button')
  overlay.type = 'button'
  overlay.title = 'Fill from Bakerrang Vault'
  overlay.innerHTML = KEY_SVG
  Object.assign(overlay.style, {
    position: 'absolute', width: `${ICON_SIZE}px`, height: `${ICON_SIZE}px`, padding: '0',
    border: 'none', borderRadius: '5px', cursor: 'pointer', background: '#4f46e5', color: '#fff',
    zIndex: 2147483646, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  })
  overlay.addEventListener('mousedown', (e) => e.preventDefault()) // keep field focus
  overlay.addEventListener('click', onIconClick)
  document.body.appendChild(overlay)
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition, true)
  reposition()
}

const isEligibleField = (el) => {
  if (!el || el.tagName !== 'INPUT') return false
  const type = (el.type || 'text').toLowerCase()
  if (type === 'password') return true
  if (!['text', 'email', 'tel'].includes(type)) return false
  // Only text-ish fields that are the detected username field or clearly
  // username-like — otherwise every text box would sprout an icon.
  const { user } = findFields()
  return el === user || looksLikeUsername(el)
}

document.addEventListener('focusin', async (e) => {
  const el = e.target
  if (!isEligibleField(el)) return
  const token = ++focusToken
  let res
  try { res = await chrome.runtime.sendMessage({ type: 'inlineMatches', payload: { url: location.href } }) } catch { return }
  if (token !== focusToken || document.activeElement !== el) return // focus moved while awaiting
  if (!res || !res.enabled || !res.matches || !res.matches.length) return
  showOverlayFor(el, res.matches)
}, true)

document.addEventListener('focusout', () => {
  // Delay so a click on the icon/chooser lands before we tear down.
  setTimeout(() => {
    const a = document.activeElement
    if (a === overlay || a === anchorEl || (chooser && chooser.contains(a))) return
    removeOverlay()
  }, 150)
}, true)

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') removeOverlay() }, true)
