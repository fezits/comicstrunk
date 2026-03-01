'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/use-auth';
import { createComment } from '@/lib/api/comments';

interface CommentFormProps {
  catalogEntryId: string;
  parentId?: string;
  onCommentSubmitted?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentForm({
  catalogEntryId,
  parentId,
  onCommentSubmitted,
  onCancel,
  autoFocus,
}: CommentFormProps) {
  const t = useTranslations('comments');
  const locale = useLocale();
  const { isAuthenticated } = useAuth();

  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const maxChars = 5000;
  const isReply = !!parentId;

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <p className="text-muted-foreground text-sm">
          <Link
            href={`/${locale}/login`}
            className="text-primary hover:underline font-medium"
          >
            {t('loginToComment')}
          </Link>
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await createComment({
        catalogEntryId,
        parentId,
        content: content.trim(),
      });
      setContent('');
      onCommentSubmitted?.();
    } catch {
      toast.error(t('error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder={isReply ? t('writeReply') : t('writeComment')}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={maxChars}
        rows={isReply ? 2 : 3}
        autoFocus={autoFocus}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {content.length}/{maxChars}
        </span>
        <div className="flex items-center gap-2">
          {isReply && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {t('cancel')}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
          >
            {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {isReply ? t('reply') : t('submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
