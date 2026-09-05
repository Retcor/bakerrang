export function faviconResponse (faviconSrc: string | null | undefined): Response {
  if (faviconSrc) {
    return new Response(null, {
      status: 302,
      headers: {
        location: faviconSrc,
        'cache-control': 'no-store'
      }
    })
  }
  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' }
  })
}