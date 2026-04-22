import type { MetadataRoute } from 'next';

const SITE_URL = 'https://comicstrunk.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.comicstrunk.com/api/v1';
const ENTRIES_PER_SITEMAP = 5000;

// Next.js calls this to know how many sitemap files to generate
export async function generateSitemaps() {
  try {
    // Get total catalog count
    const res = await fetch(`${API_URL}/catalog?limit=1&page=1`, {
      headers: { 'x-internal-key': 'comicstrunk-ssr-2026' },
    });
    const data = await res.json();
    const totalEntries = data.pagination?.total || 0;

    // Get total series count
    const sRes = await fetch(`${API_URL}/series?limit=1&page=1`, {
      headers: { 'x-internal-key': 'comicstrunk-ssr-2026' },
    });
    const sData = await sRes.json();
    const totalSeries = sData.pagination?.total || 0;

    const total = totalEntries + totalSeries;
    const numSitemaps = Math.ceil(total / ENTRIES_PER_SITEMAP) + 1; // +1 for static pages

    return Array.from({ length: numSitemaps }, (_, i) => ({ id: i }));
  } catch {
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  // First sitemap: static pages
  if (id === 0) {
    return [
      { url: `${SITE_URL}/pt-BR`, changeFrequency: 'daily', priority: 1.0 },
      { url: `${SITE_URL}/pt-BR/catalog`, changeFrequency: 'daily', priority: 0.9 },
      { url: `${SITE_URL}/pt-BR/marketplace`, changeFrequency: 'daily', priority: 0.8 },
      { url: `${SITE_URL}/pt-BR/deals`, changeFrequency: 'daily', priority: 0.7 },
      { url: `${SITE_URL}/pt-BR/contact`, changeFrequency: 'monthly', priority: 0.3 },
      { url: `${SITE_URL}/pt-BR/terms`, changeFrequency: 'yearly', priority: 0.2 },
      { url: `${SITE_URL}/pt-BR/privacy`, changeFrequency: 'yearly', priority: 0.2 },
      { url: `${SITE_URL}/pt-BR/policies`, changeFrequency: 'yearly', priority: 0.2 },
    ];
  }

  const entries: MetadataRoute.Sitemap = [];
  const offset = (id - 1) * ENTRIES_PER_SITEMAP;

  try {
    // Calculate how many catalog vs series pages to include
    const catalogRes = await fetch(`${API_URL}/catalog?limit=1&page=1`, {
      headers: { 'x-internal-key': 'comicstrunk-ssr-2026' },
    });
    const catalogData = await catalogRes.json();
    const totalCatalog = catalogData.pagination?.total || 0;

    if (offset < totalCatalog) {
      // This sitemap contains catalog entries
      const page = Math.floor(offset / 200) + 1;
      const pagesToFetch = Math.ceil(ENTRIES_PER_SITEMAP / 200);

      for (let p = 0; p < pagesToFetch; p++) {
        const res = await fetch(
          `${API_URL}/catalog?page=${page + p}&limit=200&sortBy=title&sortOrder=asc`,
          { headers: { 'Referer': SITE_URL } },
        );
        if (!res.ok) break;
        const data = await res.json();
        const items = data.data || [];
        if (items.length === 0) break;

        for (const item of items) {
          entries.push({
            url: `${SITE_URL}/pt-BR/catalog/${item.slug || item.id}`,
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        }
      }
    } else {
      // This sitemap contains series
      const seriesOffset = offset - totalCatalog;
      const page = Math.floor(seriesOffset / 200) + 1;
      const pagesToFetch = Math.ceil(ENTRIES_PER_SITEMAP / 200);

      for (let p = 0; p < pagesToFetch; p++) {
        const res = await fetch(
          `${API_URL}/series?page=${page + p}&limit=200`,
          { headers: { 'Referer': SITE_URL } },
        );
        if (!res.ok) break;
        const data = await res.json();
        const items = data.data || [];
        if (items.length === 0) break;

        for (const item of items) {
          entries.push({
            url: `${SITE_URL}/pt-BR/series/${item.slug || item.id}`,
            changeFrequency: 'monthly',
            priority: 0.7,
          });
        }
      }
    }
  } catch {
    // Return empty sitemap on error
  }

  return entries;
}
