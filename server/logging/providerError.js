export const providerErrorMetadata = (error) => ({
  status: error?.status ?? error?.response?.status,
  code: error?.code,
  name: error?.name
})

export const logProviderError = (scope, error) => {
  console.error(`[${scope}] provider error`, providerErrorMetadata(error))
}
