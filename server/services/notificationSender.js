import axios from 'axios'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const configuredValue = (env, name) => {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

// Deliberately inert outside production: local/test drains exercise the same
// outbox flow without ever delivering real mail.
export const createNotificationSender = ({ env = process.env, client = axios } = {}) => {
  const production = env.NODE_ENV === 'production'
  const apiKey = configuredValue(env, 'RESEND_API_KEY')
  const from = configuredValue(env, 'LEAD_NOTIFICATION_FROM')

  return async (snapshot) => {
    if (!production) return { id: 'local-noop' }
    if (!apiKey || !from) throw new Error('Lead notification sender is not configured')
    const response = await client.post(RESEND_ENDPOINT, {
      from,
      to: snapshot.recipients,
      ...(snapshot.replyTo ? { reply_to: snapshot.replyTo } : {}),
      subject: snapshot.subject,
      text: snapshot.text,
      html: snapshot.html
    }, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': snapshot.idempotencyKey
      },
      timeout: 10000
    })
    return response.data
  }
}

export default createNotificationSender()
