import type { RenderMode } from './renderContext'

export const PREVIEW_FORM_MESSAGE = "This is a preview — the form isn't active."

/** Prevent all non-public render modes from causing lead network side effects. */
export async function submitLeadForContext (
  mode: RenderMode,
  submitPublishedLead: () => Promise<void>
): Promise<string | null> {
  if (mode !== 'PUBLIC') return PREVIEW_FORM_MESSAGE
  await submitPublishedLead()
  return null
}
