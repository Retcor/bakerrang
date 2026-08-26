export function siteNavigationPaths (sitePath: string, currentPage: 'home' | 'contact') {
  return {
    homeHref: sitePath || '/',
    sectionPrefix: currentPage === 'home' ? '' : (sitePath || '/'),
    contactPageHref: `${sitePath}/contact`
  }
}
