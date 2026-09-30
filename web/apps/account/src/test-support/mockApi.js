// Test doubles for @bakerrang/web-api-client: the app's real provider code runs, but every request
// is answered by the current fake server.
export const serverRef = { current: null }

export const apiClientModule = (original) => ({
  ...original,
  createApiClient: () => ({
    request: (...args) => serverRef.current.client.request(...args),
    getJson: (...args) => serverRef.current.client.getJson(...args),
    resetCsrf: () => {}
  })
})
