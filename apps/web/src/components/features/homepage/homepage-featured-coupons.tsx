'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Ticket } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AffiliateDisclosure } from '@/components/features/deals/affiliate-disclosure';
import type { HomepageSectionItem } from '@/lib/api/homepage';

interface HomepageFeaturedCouponsProps {
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

function CouponCard({ item }: { item: HomepageSectionItem }) {
  const [copied, setCopied] = useState(false);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item.couponCode) return;

    try {
      await navigator.clipboard.writeText(item.couponCode);
      setCopied(true);
      toast.success('Copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      <CardContent className="p-4 space-y-3">
        {/* Store info */}
        {item.store && (
          <div className="flex items-center gap-2">
            {item.store.logoUrl ? (
              <img
                src={item.store.logoUrl}
                alt={item.store.name}
                className="h-8 w-8 rounded-md object-contain"
              />
            ) : (
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                <span className="text-xs font-bold text-muted-foreground">
                  {getStoreInitials(item.store.name)}
                </span>
              </div>
            )}
            <span className="text-sm font-medium">{item.store.name}</span>
          </div>
        )}

        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
          {item.title}
        </h3>

        {/* Discount badge */}
        {item.discount && (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
            {item.discount}
          </Badge>
        )}

        {/* Coupon code with copy button */}
        {item.couponCode && (
          <button
            onClick={handleCopyCode}
            className="w-full flex items-center justify-between gap-2 rounded-md border-2 border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm font-mono font-semibold text-primary hover:border-primary/60 hover:bg-primary/10 transition-colors"
          >
            <span className="truncate">{item.couponCode}</span>
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="h-4 w-4 shrink-0" />
            )}
          </button>
        )}

        {/* CTA button */}
        <Button asChild className="w-full" size="sm">
          <a
            href={`${apiBaseUrl}/deals/click/${item.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Usar cupom
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function HomepageFeaturedCoupons({ title, items }: HomepageFeaturedCouponsProps) {
  const displayItems = items.slice(0, 6);

  if (displayItems.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
        <Ticket className="h-6 w-6 text-primary" />
        {title || 'Cupons em Destaque'}
      </h2>

      {/* Responsive grid: 1 col mobile, 2 tablet, 3 desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayItems.map((item) => (
          <CouponCard key={item.id} item={item} />
        ))}
      </div>

      <AffiliateDisclosure />
    </section>
  );
}
