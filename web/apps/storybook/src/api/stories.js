import { jsonOrThrow, joinApiUrl } from '@bakerrang/web-api-client'

const textOrThrow = async (response) => {
  if (response.ok) return response.text()
  const message = await response.text().catch(() => '')
  const error = new Error(message || `Request failed with status ${response.status}`)
  error.status = response.status
  throw error
}

export const createStoriesApi = ({ apiClient, apiBaseUrl }) => ({
  listStories: () => apiClient.getJson('/storybook?view=summary'),
  getStory: (id) => apiClient.getJson(`/storybook/${encodeURIComponent(id)}`),
  saveStory: async (story) => jsonOrThrow(await apiClient.request('/storybook', { method: 'POST', body: story })),
  renameStory: async (id, title) => jsonOrThrow(await apiClient.request(`/storybook/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title } })),
  deleteStory: async (id) => jsonOrThrow(await apiClient.request(`/storybook/${encodeURIComponent(id)}`, { method: 'DELETE' })),
  writeStory: async (idea, { signal } = {}) => textOrThrow(await apiClient.request(`/chat/gpt/prompt/story?prompt=${encodeURIComponent(idea)}`, { signal })),
  drawPage: async (previous, text, { signal } = {}) => textOrThrow(await apiClient.request(`/chat/gpt/image/prompt?prompt=${encodeURIComponent(`${previous || ''}${text}`)}`, { signal })),
  listVoices: async () => jsonOrThrow(await apiClient.request('/text/to/speech/v1/voices')),
  narrationUrl: (voiceId, text) => `${joinApiUrl(apiBaseUrl, `/text/to/speech/v1/convert/${encodeURIComponent(voiceId)}`)}?prompt=${encodeURIComponent(text)}`
})
