'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Star } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { CatalogDetail } from '@/components/features/catalog/catalog-detail';
import { CatalogReviewList } from '@/components/features/reviews/catalog-review-list';
import { CommentThread } from '@/components/features/comments/comment-thread';
import { getCatalogEntryById, type CatalogEntry } from '@/lib/api/catalog';

function isCuid(str: string): boolean {
  return /^c[a-z0-9]{24}$/.test(str);
}

interface Props {
  idOrSlug: string;
}

export function CatalogDetailPageContent({ idOrSlug }: Props) {
  const t = useTranslations('catalog');
  const tReviews = useTranslations('reviews');
  const locale = useLocale();
  const router = useRouter();

  const [entry, setEntry] = useState<CatalogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchEntry() {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getCatalogEntryById(idOrSlug);
        if (!cancelled) {
          if (isCuid(idOrSlug) && data.slug) {
            router.replace(`/${locale}/catalog/${data.slug}`);
            return;
          }
          setEntry(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEntry();
    return () => { cancelled = true; };
  }, [idOrSlug, locale, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-col md:flex-row gap-8">
          <Skeleton className="w-64 aspect-[2/3] rounded-lg" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-96" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold">{t('detail.notFound')}</h2>
        <p className="text-muted-foreground">{t('detail.notFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/catalog`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToCatalog')}
          </Link>
        </Button>
      </div>
    );
  }

  // JSON-LD structured data for Google rich results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: entry.title,
    author: entry.author ? { '@type': 'Person', name: entry.author } : undefined,
    publisher: entry.publisher ? { '@type': 'Organization', name: entry.publisher } : undefined,
    isbn: entry.isbn || undefined,
    numberOfPages: entry.pageCount || undefined,
    datePublished: entry.publishYear ? `${entry.publishYear}` : undefined,
    image: entry.coverImageUrl || undefined,
    aggregateRating: entry.ratingCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: entry.averageRating,
      ratingCount: entry.ratingCount,
      bestRating: 5,
    } : undefined,
    url: `https://comicstrunk.com/${locale}/catalog/${entry.slug || entry.id}`,
  };

  return (
    <div className="space-y-6">
      {/* JSON-LD for Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${locale}/catalog`} className="hover:text-foreground transition-colors">
          {t('title')}
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{entry.title}</span>
      </nav>

      <CatalogDetail entry={entry} />

      <Separator className="my-8" />

      <section id="reviews">
        <div className="flex items-center gap-2 mb-6">
          <Star className="h-5 w-5" />
          <h2 className="text-xl font-semibold">{tReviews('title')}</h2>
        </div>
        <CatalogReviewList
          catalogEntryId={entry.id}
          averageRating={entry.averageRating}
          ratingCount={entry.ratingCount}
        />
      </section>

      <Separator className="my-8" />

      <section id="comments">
        <CommentThread catalogEntryId={entry.id} />
      </section>
    </div>
  );
}
