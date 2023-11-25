export const request = (url, method, headers) => {
  return fetch(url, {
    credentials: 'include',
    method,
    headers
  })
}
