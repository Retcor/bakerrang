import { headers } from 'next/headers'
import { getPublicSite } from '../../../../lib/api'
import { faviconResponse } from '../../../../lib/faviconResponse'
import { requestMatchesSharedOrigin } from '../../../../lib/requestHost'
import { resolveSharedPublicOrigin } from '../../../../lib/siteUrl'

export const dynamic = 'force-dynamic'

const sharedHostAllowed = async () => requestMatchesSharedOrigin(
  (await headers()).get('host'),
  resolveSharedPublicOrigin()
)

export async function GET (
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
): Promise<Response> {
  if (!(await sharedHostAllowed())) return faviconResponse(null)
  const { tenantId } = await params
  const site = await getPublicSite(tenantId)
  return faviconResponse(site?.branding?.faviconSrc)
}