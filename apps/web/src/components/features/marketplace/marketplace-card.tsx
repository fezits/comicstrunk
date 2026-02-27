'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, ShoppingCart, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MarketplaceListing } from '@/lib/api/marketplace';
import type { ItemCondition } from '@/lib/api/collection';

interface MarketplaceCardProps {
  listing: MarketplaceListing;
  variant?: 'grid' | 'list';
  onAddToCart?: (listingId: string) => void;
  isAddingToCart?: boolean;
}

const conditionColors: Record<ItemCondition, string> = {
  NEW: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  VERY_GOOD: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  GOOD: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  FAIR: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  POOR: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function MarketplaceCard({
  listing,
  variant = 'grid',
  onAddToCart,
  isAddingToCart,
}: MarketplaceCardProps) {
  const locale = useLocale();
  const t = useTranslations('marketplace');

  const conditionLabel = t(`conditionLabels.${listing.condition}`);
  const conditionColor = conditionColors[listing.condition] ?? '';

  if (variant === 'list') {
    return (
      <div className="relative flex bg-card text-card-foreground p-4 rounded-lg shadow-md border border-border/50 dark:border-transparent hover:scale-[1.01] transition-transform duration-300">
        {/* Cover — left */}
        <Link
          href={`/${locale}/marketplace/${listing.id}`}
          className="w-24 h-32 shrink-0 mr-4 rounded overflow-hidden bg-muted block"
        >
          {listing.catalogEntry.coverImageUrl ? (
            <img
              src={listing.catalogEntry.coverImageUrl}
              alt={listing.catalogEntry.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/5 dark:bg-muted">
              <BookOpen className="h-8 w-8 text-primary/20" />
            </div>
          )}
        </Link>

        {/* Info — center */}
        <div className="flex-1 min-w-0">
          <Link href={`/${locale}/marketplace/${listing.id}`}>
            <h3 className="font-bold text-lg line-clamp-1 hover:text-primary transition-colors">
              {listing.catalogEntry.title}
            </h3>
          </Link>

          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-xs ${conditionColor}`}>
              {conditionLabel}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
            {listing.catalogEntry.publisher && (
              <p className="truncate">{listing.catalogEntry.publisher}</p>
            )}
            <Link
              href={`/${locale}/seller/${listing.seller.id}`}
              className="flex items-center gap-1 text-xs hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <User className="h-3 w-3" />
              {listing.seller.name}
            </Link>
          </div>
        </div>

        {/* Price + Cart — right */}
        <div className="flex flex-col items-end justify-between ml-4 shrink-0">
          <span className="text-lg font-bold text-primary">
            {formatPrice(listing.salePrice)}
          </span>
          {onAddToCart && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart(listing.id);
              }}
              disabled={isAddingToCart}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('addToCart')}</span>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Grid variant (default)
  return (
    <div className="w-full flex flex-col bg-card text-card-foreground rounded-lg shadow-lg border border-border/50 dark:border-transparent hover:scale-[1.02] transition-transform duration-300 overflow-hidden group">
      {/* Cover image */}
      <Link
        href={`/${locale}/marketplace/${listing.id}`}
        className="relative aspect-[2/3] bg-muted overflow-hidden block"
      >
        {listing.catalogEntry.coverImageUrl ? (
          <img
            src={listing.catalogEntry.coverImageUrl}
            alt={listing.catalogEntry.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-primary/5 dark:bg-muted">
            <BookOpen className="h-16 w-16 text-primary/20" />
          </div>
        )}

        {/* Condition badge — top-left */}
        <Badge
          variant="outline"
          className={`absolute top-2 left-2 text-xs backdrop-blur-sm ${conditionColor}`}
        >
          {conditionLabel}
        </Badge>

        {/* Cart button — top-right on hover */}
        {onAddToCart && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart(listing.id);
              }}
              disabled={isAddingToCart}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col flex-1 px-3 py-2 overflow-hidden">
        {/* Price — prominent */}
        <div className="flex justify-center mb-1">
          <span className="text-lg font-bold text-primary">
            {formatPrice(listing.salePrice)}
          </span>
        </div>

        {/* Title — fixed height for 2 lines */}
        <Link href={`/${locale}/marketplace/${listing.id}`}>
          <h3 className="font-bold text-sm line-clamp-2 h-10 mb-1 hover:text-primary transition-colors">
            {listing.catalogEntry.title}
          </h3>
        </Link>

        {/* Details */}
        <div className="text-xs space-y-0.5 text-muted-foreground flex-1">
          {listing.catalogEntry.publisher && (
            <p className="truncate">{listing.catalogEntry.publisher}</p>
          )}
          <Link
            href={`/${locale}/seller/${listing.seller.id}`}
            className="flex items-center gap-1 hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <User className="h-3 w-3" />
            {listing.seller.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
