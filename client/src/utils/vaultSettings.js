// Non-secret vault preferences, shared by VaultProvider (auto-lock) and the
// Account settings UI. Stored server-side (plaintext) on the vault doc and read
// back via GET /vault. The browser extension mirrors these same defaults.

export const DEFAULT_SETTINGS = {
  autoLockMs: 8 * 60 * 60 * 1000, // 8 hours
  inlineAutofill: true
}

// Options for the auto-lock duration dropdown. `null` means "never lock".
export const AUTO_LOCK_OPTIONS = [
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '8 hours', value: 8 * 60 * 60 * 1000 },
  { label: 'Never', value: null }
]

// Merge a (possibly partial or missing) server settings object over the defaults.
export const withSettingDefaults = (settings) => ({ ...DEFAULT_SETTINGS, ...(settings || {}) })
