import type { Metadata } from 'next';
import { CatalogDetailPageContent } from './page-content';

// Use internal URL for SSR (avoids Cloudflare bot detection on server-to-server calls)
const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.comicstrunk.com/api/v1';
const SITE_URL = 'https://comicstrunk.com';

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

// Server-side metadata for SEO — Google sees title, description, image
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params;

  try {
    const res = await fetch(`${API_URL}/catalog/${id}`, {
      headers: { 'x-internal-key': 'comicstrunk-ssr-2026' },
      next: { revalidate: 3600 }, // Cache 1h
    });

    if (!res.ok) return { title: 'Gibi não encontrado — Comics Trunk' };
    const data = await res.json();
    const entry = data.data;
    if (!entry) return { title: 'Gibi não encontrado — Comics Trunk' };

    const title = `${entry.title}${entry.publisher ? ` — ${entry.publisher}` : ''} | Comics Trunk`;
    const description = entry.description
      || `${entry.title}${entry.author ? ` de ${entry.author}` : ''}${entry.publisher ? `, ${entry.publisher}` : ''}. Encontre no Comics Trunk.`;

    return {
      title,
      description: description.slice(0, 160),
      openGraph: {
        title,
        description: description.slice(0, 160),
        url: `${SITE_URL}/${locale}/catalog/${entry.slug || id}`,
        siteName: 'Comics Trunk',
        type: 'article',
        ...(entry.coverImageUrl && {
          images: [{ url: entry.coverImageUrl, alt: entry.title }],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title: entry.title,
        description: description.slice(0, 160),
        ...(entry.coverImageUrl && { images: [entry.coverImageUrl] }),
      },
    };
  } catch {
    return { title: 'Comics Trunk — Catálogo' };
  }
}

export default async function CatalogDetailPage({ params }: Props) {
  const { id } = await params;
  return <CatalogDetailPageContent idOrSlug={id} />;
}
