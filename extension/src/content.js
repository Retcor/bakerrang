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
