import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

process.env.CHAT_GPT_API_KEY ||= 'test-key'

const { _setOpenAI, image } = await import('../services/chatgptService.js')

afterEach(() => _setOpenAI())

test('image uses the GPT image request contract and returns base64 data', async t => {
  t.mock.method(console, 'log', () => {})

  const chatRequests = []
  const imageRequests = []
  _setOpenAI({
    chat: {
      completions: {
        create: async request => {
          chatRequests.push(request)
          return { choices: [{ message: { content: 'A safe illustrated fox prompt' } }] }
        }
      }
    },
    images: {
      generate: async request => {
        imageRequests.push(request)
        return { created: 123, data: [{ b64_json: 'generated-image-base64' }] }
      }
    }
  })

  const result = await image('A fox learns to share.')

  assert.equal(result, 'generated-image-base64')
  assert.equal(chatRequests.length, 1)
  assert.match(chatRequests[0].messages[0].content, /A fox learns to share\./)
  assert.deepEqual(imageRequests, [{
    model: 'gpt-image-2',
    prompt: 'A safe illustrated fox prompt',
    n: 1,
    size: '1024x1024'
  }])
  assert.equal(Object.hasOwn(imageRequests[0], 'response_format'), false)
})
