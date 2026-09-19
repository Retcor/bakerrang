import { SitePreviewFrameHost } from './SitePreviewFrameHost'

/** Same-origin renderer host. It receives all site data via postMessage. */
export default function SitePreviewFramePage () {
  return <SitePreviewFrameHost />
}
