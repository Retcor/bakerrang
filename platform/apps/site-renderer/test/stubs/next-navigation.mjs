export function notFound () {
  throw new Error('notFound')
}

export function permanentRedirect () {
  throw new Error('permanentRedirect')
}

export function redirect () {
  throw new Error('redirect')
}