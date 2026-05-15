import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard', '/generator', '/library', '/settings'],
    },
    sitemap: 'https://stacksmadesimple.xyz/sitemap.xml',
  }
}
