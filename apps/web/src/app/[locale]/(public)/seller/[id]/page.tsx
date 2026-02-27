'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Package, Star, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MarketplaceCard } from '@/components/features/marketplace/marketplace-card';
import {
  searchMarketplace,
  type MarketplaceListing,
  type MarketplaceSeller,
} from '@/lib/api/marketplace';
import type { PaginationMeta } from '@/lib/api/catalog';

export default function SellerProfilePage() {
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('marketplace');
  const sellerId = params.id as string;

  const [seller, setSeller] = useState<MarketplaceSeller | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function fetchSellerData() {
      setLoading(true);
      setNotFound(false);
      try {
        const result = await searchMarketplace({
          sellerId,
          page,
          limit: 20,
        });

        if (!cancelled) {
          setListings(result.data);
          setPagination(result.pagination);

          // Extract seller info from first listing
          if (result.data.length > 0) {
            setSeller(result.data[0].seller);
          } else if (page === 1) {
            // No listings on first page means seller has nothing for sale
            // Still try to show profile
            setNotFound(true);
          }
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSellerData();
    return () => {
      cancelled = true;
    };
  }, [sellerId, page]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound && !seller) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold">{t('sellerNotFound')}</h2>
        <p className="text-muted-foreground">{t('sellerNotFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/marketplace`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToMarketplace')}
          </Link>
        </Button>
      </div>
    );
  }

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
        <span className="text-foreground truncate">
          {seller?.name || t('sellerProfile')}
        </span>
      </nav>

      {/* Seller header */}
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {seller?.name || t('sellerProfile')}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {pagination?.total ?? 0} {t('itemsForSale')}
            </span>
          </div>
        </div>
      </div>

      {/* Rating placeholder */}
      <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-2">
        <Star className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('ratingsComingSoon')}</span>
      </div>

      <Separator />

      {/* Seller listings */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('itemsForSale')}</h2>

        {listings.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{t('noResults')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {listings.map((listing) => (
                <MarketplaceCard key={listing.id} listing={listing} variant="grid" />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  {t('previousPage')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t('pageOf', { current: page, total: pagination.totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('nextPage')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
