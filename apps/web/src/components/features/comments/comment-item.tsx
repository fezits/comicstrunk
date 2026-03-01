'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Heart, MessageCircle, Pencil, Trash2, Loader2, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { CommentForm } from './comment-form';
import {
  toggleCommentLike,
  updateComment,
  deleteComment,
  type Comment,
} from '@/lib/api/comments';

interface CommentItemProps {
  comment: Comment;
  catalogEntryId: string;
  currentUserId?: string;
  onReplySubmitted?: () => void;
  isReply?: boolean;
}

export function CommentItem({
  comment,
  catalogEntryId,
  currentUserId,
  onReplySubmitted,
  isReply = false,
}: CommentItemProps) {
  const t = useTranslations('comments');

  const [liked, setLiked] = useState(comment.isLiked);
  const [likesCount, setLikesCount] = useState(comment.likesCount);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUserId === comment.userId;

  const initials = comment.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const date = new Date(comment.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleLike = async () => {
    if (!currentUserId) return;
    // Optimistic update
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);

    try {
      const result = await toggleCommentLike(comment.id);
      setLiked(result.liked);
      setLikesCount(result.likesCount);
    } catch {
      // Revert on error
      setLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      await updateComment(comment.id, { content: editContent.trim() });
      setEditing(false);
      onReplySubmitted?.();
    } catch {
      toast.error(t('error'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteComment(comment.id);
      onReplySubmitted?.();
    } catch {
      toast.error(t('error'));
    } finally {
      setDeleting(false);
    }
  };

  const handleReplySubmitted = () => {
    setShowReplyForm(false);
    onReplySubmitted?.();
  };

  return (
    <div className={isReply ? 'ml-10 border-l-2 border-muted pl-4' : ''}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          {comment.user.avatarUrl ? (
            <AvatarImage src={comment.user.avatarUrl} alt={comment.user.name} />
          ) : null}
          <AvatarFallback className="text-xs">
            {initials || <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.user.name}</span>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>

          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                maxLength={5000}
                rows={2}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={!editContent.trim() || savingEdit}
                >
                  {savingEdit && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {t('edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-line">{comment.content}</p>
          )}

          {/* Action buttons */}
          {!editing && (
            <div className="flex items-center gap-1 -ml-2">
              {/* Like button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleLike}
                disabled={!currentUserId}
              >
                <Heart
                  className={`h-3.5 w-3.5 mr-1 ${
                    liked
                      ? 'fill-red-500 text-red-500'
                      : 'text-muted-foreground'
                  }`}
                />
                {likesCount > 0 && (
                  <span>{t('likesCount', { count: likesCount })}</span>
                )}
              </Button>

              {/* Reply button (only for top-level comments) */}
              {!isReply && currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1" />
                  {t('reply')}
                </Button>
              )}

              {/* Edit button (owner only) */}
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t('edit')}
                </Button>
              )}

              {/* Delete button (owner only) */}
              {isOwner && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      disabled={deleting}
                    >
                      {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      {t('delete')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('deleteConfirm')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        {t('delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline reply form */}
      {showReplyForm && (
        <div className="mt-2 ml-11">
          <CommentForm
            catalogEntryId={catalogEntryId}
            parentId={comment.id}
            onCommentSubmitted={handleReplySubmitted}
            onCancel={() => setShowReplyForm(false)}
            autoFocus
          />
        </div>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              catalogEntryId={catalogEntryId}
              currentUserId={currentUserId}
              onReplySubmitted={onReplySubmitted}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}
