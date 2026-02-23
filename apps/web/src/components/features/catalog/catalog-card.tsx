'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BookOpen } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from './star-rating';
import type { CatalogEntry } from '@/lib/api/catalog';

interface CatalogCardProps {
  entry: CatalogEntry;
}

export function CatalogCard({ entry }: CatalogCardProps) {
  const locale = useLocale();
  const categories = entry.categories.map((c) => c.category);

  return (
    <Link href={`/${locale}/catalog/${entry.id}`} className="block group">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
        {/* Cover */}
        <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden">
          {entry.coverImageUrl ? (
            <img
              src={entry.coverImageUrl}
              alt={entry.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          )}
        </div>

        <CardContent className="p-4 space-y-2">
          {/* Title */}
          <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {entry.title}
          </h3>

          {/* Author & Publisher */}
          <p className="text-sm text-muted-foreground truncate">
            {[entry.author, entry.publisher].filter(Boolean).join(' — ')}
          </p>

          {/* Series badge */}
          {entry.series && (
            <Badge variant="secondary" className="text-xs">
              {entry.series.title}
            </Badge>
          )}

          {/* Rating */}
          <StarRating rating={entry.averageRating} count={entry.ratingCount} size="sm" />

          {/* Categories (first 3) */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {categories.slice(0, 3).map((cat) => (
                <Badge key={cat.id} variant="outline" className="text-xs">
                  {cat.name}
                </Badge>
              ))}
              {categories.length > 3 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{categories.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
