export const request = (url, method, headers, body) => {
  const options = {
    credentials: 'include',
    method
  }

  if (headers) {
    options.headers = headers
  }

  if (body) {
    options.body = body
  }

  return fetch(url, options)
}

export const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }
}
