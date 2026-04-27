import type { MetadataRoute } from 'next';

const SITE_URL = 'https://comicstrunk.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/pt-BR`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/pt-BR/catalog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/pt-BR/marketplace`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/pt-BR/deals`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/pt-BR/contact`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/pt-BR/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/pt-BR/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
