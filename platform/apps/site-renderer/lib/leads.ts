'use client'

export interface LeadInput {
  name: string
  email?: string
  phone?: string
  message: string
  website?: string
}

export class LeadSubmissionError extends Error {}

const apiBaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SITE_API_BASE_URL
  if (!value) throw new LeadSubmissionError('Something went wrong. Please try again.')
  return value.replace(/\/$/, '')
}

const safeValidationMessage = async (response: Response) => {
  try {
    const body = await response.json() as { error?: unknown }
    return typeof body.error === 'string' && body.error.length <= 200
      ? body.error
      : 'Please check your information and try again.'
  } catch {
    return 'Please check your information and try again.'
  }
}

export async function submitLead (tenantId: string, input: LeadInput): Promise<void> {
  let response: Response
  try {
    response = await fetch(
      `${apiBaseUrl()}/public/sites/${encodeURIComponent(tenantId)}/leads`,
      {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input)
      }
    )
  } catch (error) {
    if (error instanceof LeadSubmissionError) throw error
    throw new LeadSubmissionError('Something went wrong. Please try again.')
  }

  if (response.status === 201) return
  if (response.status === 400) throw new LeadSubmissionError(await safeValidationMessage(response))
  if (response.status === 404) {
    throw new LeadSubmissionError("This form isn't accepting submissions yet.")
  }
  if (response.status === 429) {
    throw new LeadSubmissionError('Too many attempts. Please try again later.')
  }
  throw new LeadSubmissionError('Something went wrong. Please try again.')
}
