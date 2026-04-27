'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BookOpen, Check } from 'lucide-react';

import { CoverImage } from '@/components/ui/cover-image';
import type { CatalogEntry } from '@/lib/api/catalog';

interface CatalogCardCompactProps {
  entry: CatalogEntry;
  isOwned?: boolean;
}

export function CatalogCardCompact({ entry, isOwned = false }: CatalogCardCompactProps) {
  const locale = useLocale();

  return (
    <Link
      href={`/${locale}/catalog/${entry.slug ?? entry.id}`}
      className="group block rounded-lg border overflow-hidden hover:border-primary/50 transition-colors"
    >
      <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden relative">
        {entry.coverImageUrl ? (
          <CoverImage
            src={entry.coverImageUrl}
            alt={entry.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
        )}

        {isOwned && (
          <div className="absolute top-1 left-1 bg-green-600 text-white rounded-full p-0.5">
            <Check className="h-2.5 w-2.5" />
          </div>
        )}
      </div>

      <div className="p-1.5 space-y-0.5">
        <p className="text-xs font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {entry.title}
        </p>
        {entry.publisher && (
          <p className="text-[10px] text-muted-foreground truncate">{entry.publisher}</p>
        )}
      </div>
    </Link>
  );
}
