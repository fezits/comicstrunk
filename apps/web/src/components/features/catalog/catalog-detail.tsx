'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StarRating } from './star-rating';
import type { CatalogEntry } from '@/lib/api/catalog';

interface CatalogDetailProps {
  entry: CatalogEntry;
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

export function CatalogDetail({ entry }: CatalogDetailProps) {
  const t = useTranslations('catalog.detail');
  const locale = useLocale();

  const categories = entry.categories.map((c) => c.category);
  const tags = entry.tags.map((tg) => tg.tag);
  const characters = entry.characters.map((c) => c.character);

  const seriesInfo = entry.series
    ? [
        entry.series.title,
        entry.volumeNumber != null ? `Vol. ${entry.volumeNumber}` : null,
        entry.editionNumber != null ? `Ed. ${entry.editionNumber}` : null,
      ]
        .filter(Boolean)
        .join(' — ')
    : null;

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Cover */}
      <div className="shrink-0 mx-auto md:mx-0">
        <div className="w-64 aspect-[2/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
          {entry.coverImageUrl ? (
            <img
              src={entry.coverImageUrl}
              alt={entry.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <BookOpen className="h-16 w-16 text-muted-foreground/40" />
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex-1 space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{entry.title}</h1>

        <StarRating rating={entry.averageRating} count={entry.ratingCount} size="lg" />

        <div className="space-y-1.5">
          <DetailRow label={t('author')} value={entry.author} />
          <DetailRow label={t('publisher')} value={entry.publisher} />
          <DetailRow label={t('imprint')} value={entry.imprint} />
          {seriesInfo && (
            <div className="flex gap-2 text-sm">
              <span className="text-muted-foreground shrink-0">{t('series')}:</span>
              <Link
                href={`/${locale}/series/${entry.series!.id}`}
                className="text-primary hover:underline"
              >
                {seriesInfo}
              </Link>
            </div>
          )}
          <DetailRow label={t('barcode')} value={entry.barcode} />
          <DetailRow label={t('isbn')} value={entry.isbn} />
          {entry.volumeNumber != null && !entry.series && (
            <DetailRow label={t('volume')} value={entry.volumeNumber} />
          )}
          {entry.editionNumber != null && !entry.series && (
            <DetailRow label={t('edition')} value={entry.editionNumber} />
          )}
        </div>

        {entry.description && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-semibold mb-2">{t('description')}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {entry.description}
              </p>
            </div>
          </>
        )}

        {categories.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium mb-2">{t('categories')}</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge key={cat.id} variant="secondary">
                    {cat.name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {tags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">{t('tags')}</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {characters.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">{t('characters')}</h3>
            <div className="flex flex-wrap gap-2">
              {characters.map((char) => (
                <Badge key={char.id} variant="outline">
                  {char.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
