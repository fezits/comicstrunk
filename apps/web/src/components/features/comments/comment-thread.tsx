'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { CommentForm } from './comment-form';
import { CommentItem } from './comment-item';
import { useAuth } from '@/lib/auth/use-auth';
import { getCatalogComments, type Comment } from '@/lib/api/comments';

interface CommentThreadProps {
  catalogEntryId: string;
}

export function CommentThread({ catalogEntryId }: CommentThreadProps) {
  const t = useTranslations('comments');
  const { user } = useAuth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const fetchComments = useCallback(
    async (pageNum: number, append = false) => {
      try {
        const result = await getCatalogComments(catalogEntryId, {
          page: pageNum,
          limit,
        });
        if (append) {
          setComments((prev) => [...prev, ...result.data]);
        } else {
          setComments(result.data);
        }
        setTotal(result.pagination.total);
      } catch {
        // Silently handle
      }
    },
    [catalogEntryId],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await fetchComments(1);
    setPage(1);
    setLoading(false);
  }, [fetchComments]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    await fetchComments(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleCommentSubmitted = () => {
    loadInitial();
  };

  const hasMore = comments.length < total;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with count */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h2 className="text-lg font-semibold">
          {t('commentCount', { count: total })}
        </h2>
      </div>

      {/* New comment form */}
      <CommentForm
        catalogEntryId={catalogEntryId}
        onCommentSubmitted={handleCommentSubmitted}
      />

      <Separator />

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {t('noComments')}
        </p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              catalogEntryId={catalogEntryId}
              currentUserId={user?.id}
              onReplySubmitted={handleCommentSubmitted}
            />
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
