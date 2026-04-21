'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/ui/star-rating';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { CatalogReviewForm } from './catalog-review-form';
import { useAuth } from '@/lib/auth/use-auth';
import {
  getCatalogReviews,
  getUserReviewForCatalog,
  type Review,
} from '@/lib/api/reviews';

interface CatalogReviewListProps {
  catalogEntryId: string;
  averageRating: number;
  ratingCount: number;
}

export function CatalogReviewList({
  catalogEntryId,
  averageRating,
  ratingCount,
}: CatalogReviewListProps) {
  const t = useTranslations('reviews');
  const { isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchReviews = useCallback(async (pageNum: number, append = false) => {
    try {
      const result = await getCatalogReviews(catalogEntryId, {
        page: pageNum,
        limit,
      });
      if (append) {
        setReviews((prev) => [...prev, ...result.data]);
      } else {
        setReviews(result.data);
      }
      setTotal(result.pagination.total);
    } catch {
      // Silently handle errors for listing
    }
  }, [catalogEntryId]);

  const fetchMyReview = useCallback(async () => {
    if (!isAuthenticated) {
      setMyReview(null);
      return;
    }
    try {
      const review = await getUserReviewForCatalog(catalogEntryId);
      setMyReview(review);
    } catch {
      setMyReview(null);
    }
  }, [catalogEntryId, isAuthenticated]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchReviews(1), fetchMyReview()]);
    setPage(1);
    setLoading(false);
  }, [fetchReviews, fetchMyReview]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    await fetchReviews(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleReviewSubmitted = () => {
    loadInitial();
  };

  const hasMore = reviews.length < total;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Average Rating Summary */}
      <div className="flex items-center gap-3">
        <StarRating rating={Number(averageRating) || 0} size="lg" />
        <span className="text-lg font-semibold">
          {(Number(averageRating) || 0).toFixed(1)}
        </span>
        <span className="text-muted-foreground">
          ({t('reviewCount', { count: ratingCount })})
        </span>
      </div>

      <Separator />

      {/* User's own review form */}
      <CatalogReviewForm
        catalogEntryId={catalogEntryId}
        existingReview={myReview}
        onReviewSubmitted={handleReviewSubmitted}
      />

      <Separator />

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {t('noReviews')}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
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
    <div className="flex gap-3 p-3 rounded-lg bg-muted/30">
      <Avatar className="h-8 w-8 shrink-0">
        {review.user.avatarUrl ? (
          <AvatarImage src={review.user.avatarUrl} alt={review.user.name} />
        ) : null}
        <AvatarFallback className="text-xs">
          {initials || <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{review.user.name}</span>
          <StarRating rating={review.rating} size="sm" />
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        {review.text && (
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {review.text}
          </p>
        )}
      </div>
    </div>
  );
}
