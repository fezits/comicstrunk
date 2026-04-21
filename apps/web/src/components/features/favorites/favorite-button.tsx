'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/use-auth';
import { toggleFavorite, checkIsFavorited } from '@/lib/api/favorites';

interface FavoriteButtonProps {
  catalogEntryId: string;
  initialFavorited?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  /** Called after a successful toggle with the new favorited state */
  onToggle?: (favorited: boolean) => void;
}

export function FavoriteButton({
  catalogEntryId,
  initialFavorited,
  size = 'sm',
  className,
  onToggle,
}: FavoriteButtonProps) {
  const t = useTranslations('favorites');
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [isFavorited, setIsFavorited] = useState(initialFavorited ?? false);
  const [isToggling, setIsToggling] = useState(false);

  // Check initial favorited state from API if not provided and user is authenticated
  useEffect(() => {
    if (initialFavorited !== undefined) return;
    if (!isAuthenticated || authLoading) return;

    let cancelled = false;
    checkIsFavorited(catalogEntryId)
      .then((result) => {
        if (!cancelled) setIsFavorited(result.isFavorited);
      })
      .catch(() => {
        // Silently fail — not critical
      });

    return () => {
      cancelled = true;
    };
  }, [catalogEntryId, initialFavorited, isAuthenticated, authLoading]);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Redirect unauthenticated users to login
      if (!isAuthenticated) {
        router.push(`/${locale}/login`);
        return;
      }

      if (isToggling) return;

      // Optimistic update
      const previousState = isFavorited;
      setIsFavorited(!previousState);
      setIsToggling(true);

      try {
        const result = await toggleFavorite(catalogEntryId);
        setIsFavorited(result.favorited);
        onToggle?.(result.favorited);
      } catch {
        // Revert optimistic update on error
        setIsFavorited(previousState);
        toast.error(t('error'));
      } finally {
        setIsToggling(false);
      }
    },
    [isAuthenticated, isToggling, isFavorited, catalogEntryId, locale, router, onToggle, t],
  );

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const buttonSize = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isToggling}
      aria-label={isFavorited ? t('removeFromFavorites') : t('addToFavorites')}
      className={cn(
        buttonSize,
        'flex items-center justify-center rounded-full transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isFavorited
          ? 'text-red-500 hover:text-red-600'
          : 'text-muted-foreground hover:text-red-500',
        isToggling && 'opacity-50 cursor-wait',
        className,
      )}
    >
      <Heart
        className={cn(iconSize, 'transition-transform duration-200', isToggling && 'scale-90')}
        fill={isFavorited ? 'currentColor' : 'none'}
      />
    </button>
  );
}
