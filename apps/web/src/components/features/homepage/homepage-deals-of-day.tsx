'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowRight, Clock, ExternalLink, Tag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AffiliateDisclosure } from '@/components/features/deals/affiliate-disclosure';
import type { HomepageSectionItem } from '@/lib/api/homepage';

interface HomepageDealsOfDayProps {
  title: string | null;
  items: HomepageSectionItem[];
}

function getStoreInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function calculate() {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diffMs = expiry.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft('Expirado');
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 7) {
        setTimeLeft('');
        return;
      }

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    }

    calculate();
    const interval = setInterval(calculate, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft) return null;

  return (
    <Badge
      variant="outline"
      className="bg-background/80 border-yellow-500 text-yellow-600 dark:text-yellow-400 text-xs"
    >
      <Clock className="h-3 w-3 mr-1" />
      {timeLeft}
    </Badge>
  );
}

export function HomepageDealsOfDay({ title, items }: HomepageDealsOfDayProps) {
  const locale = useLocale();
  const displayItems = items.slice(0, 6);

  if (displayItems.length === 0) return null;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Tag className="h-6 w-6 text-primary" />
          {title || 'Ofertas do Dia'}
        </h2>
        <Link
          href={`/${locale}/deals`}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          Ver todas as ofertas
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20">
        {displayItems.map((item) => (
          <Card
            key={item.id}
            className="min-w-[280px] max-w-[320px] flex-shrink-0 snap-start overflow-hidden transition-all hover:shadow-lg hover:border-primary/30"
          >
            {/* Banner area */}
            <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden">
              {item.bannerUrl ? (
                <img
                  src={item.bannerUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-3xl font-bold text-primary/30">
                    {item.store ? getStoreInitials(item.store.name) : 'CT'}
                  </span>
                </div>
              )}

              {/* Discount badge */}
              {item.discount && (
                <div className="absolute bottom-2 left-2">
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent text-sm px-3 py-1 font-bold">
                    {item.discount}
                  </Badge>
                </div>
              )}

              {/* Expiry countdown */}
              {item.expiresAt && (
                <div className="absolute top-2 right-2">
                  <ExpiryCountdown expiresAt={item.expiresAt} />
                </div>
              )}
            </div>

            <CardContent className="p-4 space-y-3">
              {/* Store info */}
              {item.store && (
                <div className="flex items-center gap-2">
                  {item.store.logoUrl ? (
                    <img
                      src={item.store.logoUrl}
                      alt={item.store.name}
                      className="h-5 w-5 rounded-sm object-contain"
                    />
                  ) : (
                    <div className="h-5 w-5 rounded-sm bg-muted flex items-center justify-center">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {getStoreInitials(item.store.name).charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground font-medium">
                    {item.store.name}
                  </span>
                </div>
              )}

              {/* Title */}
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                {item.title}
              </h3>

              {/* CTA button */}
              <Button asChild className="w-full" size="sm">
                <a
                  href={`${apiBaseUrl}/deals/click/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver oferta
                  <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}

        {/* "See all" card at the end */}
        <Link
          href={`/${locale}/deals`}
          className="min-w-[200px] flex-shrink-0 snap-start flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-3 text-primary hover:text-primary/80 transition-colors">
            <div className="h-12 w-12 rounded-full border-2 border-primary/30 flex items-center justify-center">
              <ArrowRight className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium">Ver todas as ofertas</span>
          </div>
        </Link>
      </div>

      <AffiliateDisclosure />
    </section>
  );
}
