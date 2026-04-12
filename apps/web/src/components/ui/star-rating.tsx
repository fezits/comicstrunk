'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

const sizeMap = {
  sm: { icon: 'h-4 w-4', px: 16 },
  md: { icon: 'h-5 w-5', px: 20 },
  lg: { icon: 'h-6 w-6', px: 24 },
};

export function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const safeRating = Number(rating) || 0;
  const displayRating = interactive && hoverRating > 0 ? hoverRating : safeRating;
  const { icon: iconSize } = sizeMap[size];

  const fullStars = Math.floor(displayRating);
  const hasHalf = !interactive && displayRating - fullStars >= 0.25 && displayRating - fullStars < 0.75;
  const isFull = (i: number) => i < fullStars || (!interactive && displayRating - fullStars >= 0.75 && i === fullStars);

  if (interactive) {
    return (
      <div
        className={cn('inline-flex items-center gap-0.5', className)}
        role="radiogroup"
        aria-label={`Avaliacao: ${safeRating} de ${maxStars} estrelas`}
      >
        {Array.from({ length: maxStars }).map((_, i) => {
          const starValue = i + 1;
          const filled = starValue <= displayRating;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={starValue === safeRating}
              aria-label={`${starValue} estrela${starValue > 1 ? 's' : ''}`}
              className="cursor-pointer p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              onClick={() => onChange?.(starValue)}
              onMouseEnter={() => setHoverRating(starValue)}
              onMouseLeave={() => setHoverRating(0)}
            >
              <Star
                className={cn(
                  iconSize,
                  filled
                    ? 'fill-amber-500 text-amber-500'
                    : 'text-muted-foreground/40',
                )}
              />
            </button>
          );
        })}
      </div>
    );
  }

  // Display mode (read-only)
  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={`Avaliacao: ${safeRating.toFixed(1)} de ${maxStars} estrelas`}
    >
      {Array.from({ length: maxStars }).map((_, i) => {
        if (isFull(i)) {
          return (
            <Star
              key={i}
              className={cn(iconSize, 'fill-amber-500 text-amber-500')}
            />
          );
        }
        if (hasHalf && i === fullStars) {
          return (
            <div key={i} className="relative">
              <Star className={cn(iconSize, 'text-muted-foreground/40')} />
              <div className="absolute inset-0 overflow-hidden w-1/2">
                <Star className={cn(iconSize, 'fill-amber-500 text-amber-500')} />
              </div>
            </div>
          );
        }
        return (
          <Star
            key={i}
            className={cn(iconSize, 'text-muted-foreground/40')}
          />
        );
      })}
    </div>
  );
}
