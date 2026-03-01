'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from '@/components/ui/star-rating';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth/use-auth';
import {
  createCatalogReview,
  updateReview,
  deleteReview,
  type Review,
} from '@/lib/api/reviews';

interface CatalogReviewFormProps {
  catalogEntryId: string;
  existingReview?: Review | null;
  onReviewSubmitted?: () => void;
}

export function CatalogReviewForm({
  catalogEntryId,
  existingReview,
  onReviewSubmitted,
}: CatalogReviewFormProps) {
  const t = useTranslations('reviews');
  const locale = useLocale();
  const { isAuthenticated } = useAuth();

  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [text, setText] = useState(existingReview?.text ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!existingReview;
  const maxChars = 2000;

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-muted-foreground">
          <Link
            href={`/${locale}/login`}
            className="text-primary hover:underline font-medium"
          >
            {t('loginToReview')}
          </Link>
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateReview(existingReview.id, {
          rating,
          text: text.trim() || undefined,
        });
        toast.success(t('updateReview'));
      } else {
        await createCatalogReview({
          catalogEntryId,
          rating,
          text: text.trim() || undefined,
        });
        toast.success(t('submitReview'));
      }
      onReviewSubmitted?.();
    } catch {
      toast.error(t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview) return;
    setDeleting(true);
    try {
      await deleteReview(existingReview.id);
      toast.success(t('deleteReview'));
      setRating(0);
      setText('');
      onReviewSubmitted?.();
    } catch {
      toast.error(t('error'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">
        {isEditing ? t('editReview') : t('writeReview')}
      </h3>

      <div className="space-y-1">
        <StarRating
          rating={rating}
          interactive
          onChange={setRating}
          size="lg"
        />
      </div>

      <div className="space-y-1">
        <Textarea
          placeholder={t('reviewPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={maxChars}
          rows={4}
        />
        <p className="text-xs text-muted-foreground text-right">
          {text.length}/{maxChars}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? t('updateReview') : t('submitReview')}
        </Button>

        {isEditing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" disabled={deleting}>
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteReview')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteConfirm')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  {t('deleteReview')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
