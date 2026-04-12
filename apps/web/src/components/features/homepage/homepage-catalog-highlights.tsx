'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BookOpen, Star, ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { HomepageSectionItem } from '@/lib/api/homepage';

interface HomepageCatalogHighlightsProps {
  title: string | null;
  items: HomepageSectionItem[];
}

function MiniStarRating({ rating, count }: { rating: number; count: number }) {
  const safeRating = Number(rating) || 0;
  const safeCount = Number(count) || 0;
  const fullStars = Math.floor(safeRating);
  const hasHalf = safeRating - fullStars >= 0.5;

  if (safeCount === 0) {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-3 w-3 text-muted-foreground/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i < fullStars
              ? 'fill-yellow-500 text-yellow-500'
              : i === fullStars && hasHalf
                ? 'fill-yellow-500/50 text-yellow-500'
                : 'text-muted-foreground/30',
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">
        {safeRating.toFixed(1)}
      </span>
    </div>
  );
}

export function HomepageCatalogHighlights({ title, items }: HomepageCatalogHighlightsProps) {
  const locale = useLocale();
  const displayItems = items.slice(0, 8);

  if (displayItems.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold">
          {title || 'Catalogo em Destaque'}
        </h2>
        <Link
          href={`/${locale}/catalog`}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          Ver todos
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Grid: 4 cols desktop, 2 mobile. Horizontal scroll on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {displayItems.map((item) => (
          <Link
            key={item.id}
            href={`/${locale}/catalog/${item.id}`}
            className="block group"
          >
            <div className="bg-card text-card-foreground rounded-lg shadow-lg border border-border/50 dark:border-transparent hover:scale-[1.02] transition-transform duration-300 overflow-hidden">
              {/* Cover image */}
              <div className="relative aspect-[2/3] bg-muted overflow-hidden">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-primary/5 dark:bg-muted">
                    <BookOpen className="h-16 w-16 text-primary/20" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="px-3 py-2">
                {/* Star rating */}
                <div className="flex justify-center mb-1">
                  <MiniStarRating
                    rating={item.averageRating ?? 0}
                    count={item.ratingCount ?? 0}
                  />
                </div>

                {/* Title */}
                <h3 className="font-bold text-sm line-clamp-2 h-10 text-center">
                  {item.title}
                </h3>

                {/* Series badge */}
                {item.seriesName && (
                  <div className="flex justify-center mt-1">
                    <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
                      <BookOpen className="h-3 w-3 text-primary" />
                      <span className="text-xs text-foreground line-clamp-1">
                        {item.seriesName}
                      </span>
                    </span>
                  </div>
                )}

                {/* CTA */}
                <p className="text-xs text-primary text-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver detalhes
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
