'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  count: number;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function StarRating({ rating, count, size = 'md' }: StarRatingProps) {
  const t = useTranslations('catalog');
  const starSize = sizeMap[size];
  const safeRating = Number(rating) || 0;
  const safeCount = Number(count) || 0;
  const fullStars = Math.floor(safeRating);
  const hasHalf = safeRating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  if (safeCount === 0) {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn(starSize, 'text-muted-foreground/30')} />
        ))}
        <span className="text-xs text-muted-foreground ml-1">{t('noReviews')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`full-${i}`} className={cn(starSize, 'fill-yellow-500 text-yellow-500')} />
      ))}
      {hasHalf && (
        <div className="relative">
          <Star className={cn(starSize, 'text-muted-foreground/30')} />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className={cn(starSize, 'fill-yellow-500 text-yellow-500')} />
          </div>
        </div>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Star key={`empty-${i}`} className={cn(starSize, 'text-muted-foreground/30')} />
      ))}
      <span className="text-sm ml-1">{safeRating.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">
        ({safeCount} {t('reviews')})
      </span>
    </div>
  );
}
