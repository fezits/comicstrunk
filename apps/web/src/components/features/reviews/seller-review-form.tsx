'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from '@/components/ui/star-rating';
import { createSellerReview } from '@/lib/api/reviews';

interface SellerReviewFormProps {
  sellerId: string;
  orderId: string;
  onReviewSubmitted?: () => void;
}

export function SellerReviewForm({
  sellerId,
  orderId,
  onReviewSubmitted,
}: SellerReviewFormProps) {
  const t = useTranslations('reviews');

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const maxChars = 2000;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await createSellerReview({
        sellerId,
        orderId,
        rating,
        text: text.trim() || undefined,
      });
      toast.success(t('rateSeller'));
      onReviewSubmitted?.();
    } catch {
      toast.error(t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">{t('rateSeller')}</h3>

      <StarRating
        rating={rating}
        interactive
        onChange={setRating}
        size="lg"
      />

      <div className="space-y-1">
        <Textarea
          placeholder={t('sellerReviewPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={maxChars}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">
          {text.length}/{maxChars}
        </p>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={rating === 0 || submitting}
      >
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {t('rateSeller')}
      </Button>
    </div>
  );
}
