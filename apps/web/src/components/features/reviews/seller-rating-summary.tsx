'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { User } from 'lucide-react';

import { StarRating } from '@/components/ui/star-rating';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getSellerReviews, type Review } from '@/lib/api/reviews';

interface SellerRatingSummaryProps {
  sellerId: string;
}

export function SellerRatingSummary({ sellerId }: SellerRatingSummaryProps) {
  const t = useTranslations('reviews');

  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSellerReviews() {
      setLoading(true);
      try {
        const result = await getSellerReviews(sellerId, { page: 1, limit: 5 });
        setAverageRating(result.data.averageRating);
        setRatingCount(result.data.ratingCount);
        setRecentReviews(result.data.reviews);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }

    fetchSellerReviews();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('sellerRatings')}</h3>

      <div className="flex items-center gap-3">
        <StarRating rating={averageRating} size="lg" />
        <span className="text-lg font-semibold">
          {averageRating.toFixed(1)}
        </span>
        <span className="text-muted-foreground">
          ({t('reviewCount', { count: ratingCount })})
        </span>
      </div>

      {recentReviews.length > 0 && (
        <div className="space-y-3">
          {recentReviews.map((review) => {
            const initials = review.user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const date = new Date(review.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div key={review.id} className="flex gap-3 text-sm">
                <Avatar className="h-7 w-7 shrink-0">
                  {review.user.avatarUrl ? (
                    <AvatarImage src={review.user.avatarUrl} alt={review.user.name} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {initials || <User className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{review.user.name}</span>
                    <StarRating rating={review.rating} size="sm" />
                    <span className="text-xs text-muted-foreground">{date}</span>
                  </div>
                  {review.text && (
                    <p className="text-muted-foreground line-clamp-2">
                      {review.text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
