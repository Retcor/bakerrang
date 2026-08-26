export const PREVIEW_FORM_MESSAGE = "This is a preview — the form isn't active."

export async function submitLeadForContext (
  preview: boolean,
  submitPublishedLead: () => Promise<void>
): Promise<string | null> {
  if (preview) return PREVIEW_FORM_MESSAGE
  await submitPublishedLead()
  return null
}
