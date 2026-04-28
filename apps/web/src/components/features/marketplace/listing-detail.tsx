'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, ShoppingCart, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  getMarketplaceListing,
  type MarketplaceListing,
} from '@/lib/api/marketplace';
import { addToCart } from '@/lib/api/cart';
import { previewCommission, type CommissionPreview } from '@/lib/api/commission';
import { useAuth } from '@/lib/auth/use-auth';
import { useCart } from '@/contexts/cart-context';
import type { ItemCondition } from '@/lib/api/collection';

interface ListingDetailProps {
  id: string;
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

export function ListingDetail({ id }: ListingDetailProps) {
  const locale = useLocale();
  const t = useTranslations('marketplace');
  const { user, isAuthenticated } = useAuth();
  const { incrementCount } = useCart();

  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [, setCommission] = useState<CommissionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getMarketplaceListing(id);
        if (!cancelled) {
          setListing(data);
          // Fetch commission preview if authenticated
          if (isAuthenticated && data.salePrice) {
            try {
              const preview = await previewCommission(data.salePrice);
              if (!cancelled) setCommission(preview);
            } catch {
              // Commission preview is optional, fail silently
            }
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  const handleAddToCart = async () => {
    if (!listing) return;

    if (!isAuthenticated) {
      toast.error(t('loginToAdd'));
      return;
    }

    if (user && listing.seller.id === user.id) {
      toast.error(t('ownItem'));
      return;
    }

    setAddingToCart(true);
    try {
      await addToCart(listing.id);
      incrementCount();
      toast.success(t('addedToCart'));
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      if (status === 409) {
        toast.error(t('itemReserved'));
      } else {
        toast.error(message || t('addToCartError'));
      }
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-col md:flex-row gap-8">
          <Skeleton className="w-64 aspect-[2/3] rounded-lg" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-96" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold">{t('listingNotFound')}</h2>
        <p className="text-muted-foreground">{t('listingNotFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/marketplace`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToMarketplace')}
          </Link>
        </Button>
      </div>
    );
  }

  const isOwnItem = user && listing.seller.id === user.id;
  const conditionLabel = t(`conditionLabels.${listing.condition}`);
  const conditionColor = conditionColors[listing.condition] ?? '';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${locale}/marketplace`}
          className="hover:text-foreground transition-colors"
        >
          {t('title')}
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{listing.catalogEntry.title}</span>
      </nav>

      {/* Content */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Cover image */}
        <div className="w-full md:w-72 shrink-0">
          <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-lg">
            {listing.catalogEntry.coverImageUrl ? (
              <img
                src={listing.catalogEntry.coverImageUrl}
                alt={listing.catalogEntry.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-primary/5 dark:bg-muted">
                <BookOpen className="h-20 w-20 text-primary/20" />
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">
            {listing.catalogEntry.title}
          </h1>

          {/* Condition + Price */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className={`text-sm px-3 py-1 ${conditionColor}`}>
              {conditionLabel}
            </Badge>
            <span className="text-3xl font-bold text-primary">
              {formatPrice(listing.salePrice)}
            </span>
          </div>

          {/* Details grid */}
          <div className="space-y-2 text-sm">
            {listing.catalogEntry.author && (
              <p>
                <span className="font-semibold text-foreground">Autor:</span>{' '}
                <span className="text-muted-foreground">{listing.catalogEntry.author}</span>
              </p>
            )}
            {listing.catalogEntry.publisher && (
              <p>
                <span className="font-semibold text-foreground">Editora:</span>{' '}
                <span className="text-muted-foreground">{listing.catalogEntry.publisher}</span>
              </p>
            )}
            {listing.catalogEntry.volumeNumber && (
              <p>
                <span className="font-semibold text-foreground">Volume:</span>{' '}
                <span className="text-muted-foreground">{listing.catalogEntry.volumeNumber}</span>
              </p>
            )}
            {listing.catalogEntry.editionNumber && (
              <p>
                <span className="font-semibold text-foreground">Edicao:</span>{' '}
                <span className="text-muted-foreground">{listing.catalogEntry.editionNumber}</span>
              </p>
            )}
          </div>

          <Separator />

          {/* Seller info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('seller')}</p>
              <Link
                href={`/${locale}/seller/${listing.seller.id}`}
                className="text-sm text-primary hover:underline"
              >
                {listing.seller.name}
              </Link>
            </div>
          </div>

          <Separator />

          {/* Add to cart */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="gap-2 flex-1 h-12 text-base"
              onClick={handleAddToCart}
              disabled={addingToCart || !!isOwnItem}
            >
              <ShoppingCart className="h-5 w-5" />
              {addingToCart
                ? t('addingToCart')
                : isOwnItem
                  ? t('ownItem')
                  : t('addToCart')}
            </Button>
            <Button variant="outline" size="lg" className="h-12" asChild>
              <Link href={`/${locale}/seller/${listing.seller.id}`}>
                {t('viewSeller')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
