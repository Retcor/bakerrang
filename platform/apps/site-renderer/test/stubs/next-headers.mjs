export async function headers () {
  const host = globalThis.__rendererTestHost
  return new Headers(host ? { host } : {})
}