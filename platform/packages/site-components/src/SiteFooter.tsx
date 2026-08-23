import { SiteContainer } from './SitePrimitives'
import type { SiteNavItem } from './SiteHeader'
import type { SocialLink, SocialPlatform } from '@bakerrang/site-schema'
import { isSafeSocialUrl } from './socialLinks'

const socialLabels: Record<SocialPlatform, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
  youtube: 'YouTube', tiktok: 'TikTok', x: 'X'
}

function SocialIcon ({ platform }: { platform: SocialPlatform }) {
  if (platform === 'facebook') return <svg aria-hidden className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.6 1.7-1.6H17V3.8c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5V10H7v3h3v8h3.5Z" /></svg>
  if (platform === 'instagram') return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24"><rect height="17" rx="5" stroke="currentColor" strokeWidth="2" width="17" x="3.5" y="3.5" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.7" fill="currentColor" r="1.1" /></svg>
  if (platform === 'linkedin') return <svg aria-hidden className="size-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5.3 7.6A2.3 2.3 0 1 0 5.3 3a2.3 2.3 0 0 0 0 4.6ZM3.4 9.2h3.8V21H3.4V9.2Zm6.1 0h3.6v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-3.8v-5.5c0-1.3 0-3-1.9-3s-2.2 1.4-2.2 2.9V21H9.5V9.2Z" /></svg>
  if (platform === 'youtube') return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24"><path d="M21 8.2a3 3 0 0 0-2.1-2.1C17 5.6 12 5.6 12 5.6s-5 0-6.9.5A3 3 0 0 0 3 8.2 31 31 0 0 0 2.6 12 31 31 0 0 0 3 15.8a3 3 0 0 0 2.1 2.1c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8Z" stroke="currentColor" strokeWidth="1.8" /><path d="m10 15 5-3-5-3v6Z" fill="currentColor" /></svg>
  if (platform === 'tiktok') return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24"><path d="M14 4v10.3a4.7 4.7 0 1 1-4-4.6m4-5.7c.4 2.3 1.8 3.7 4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" /></svg>
  return <svg aria-hidden className="size-5" fill="none" viewBox="0 0 24 24"><path d="M5 4.5 19 19.5M19 4.5 5 19.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" /></svg>
}

export function SiteFooter ({ siteName, navItems, socialLinks }: { siteName: string, navItems: SiteNavItem[], socialLinks?: SocialLink[] }) {
  const safeSocialLinks = (Array.isArray(socialLinks) ? socialLinks : []).filter((link) =>
    link && socialLabels[link.platform] && isSafeSocialUrl(link.url)
  )
  return (
    <footer className="border-t-4 border-site-accent bg-site-footer py-12 text-site-footer-fg" data-br-role="footer">
      <SiteContainer className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{siteName}</p>
          <p className="mt-1 text-sm opacity-75">© {new Date().getFullYear()} {siteName}</p>
        </div>
        <div className="flex flex-col gap-4 sm:items-end">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3" data-br-role="nav">
            {navItems.map((item) => <a className="text-sm opacity-85 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-site-accent" href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
          {safeSocialLinks.length > 0 && (
            <nav aria-label="Social profiles" className="flex flex-wrap gap-2" data-br-role="social">
              {safeSocialLinks.map((link) => <a aria-label={socialLabels[link.platform]} className="site-radius-control inline-flex min-h-11 min-w-11 items-center justify-center opacity-80 hover:bg-white/10 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-accent" href={link.url} key={link.platform} rel="noopener noreferrer" target="_blank"><SocialIcon platform={link.platform} /></a>)}
            </nav>
          )}
        </div>
      </SiteContainer>
    </footer>
  )
}
