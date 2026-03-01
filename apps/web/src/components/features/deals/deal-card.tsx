'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Copy, Check, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DealTypeBadge } from './deal-type-badge';
import { type Deal, getClickUrl } from '@/lib/api/deals';

function getDaysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getStoreInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface DealCardProps {
  deal: Deal;
}

export function DealCard({ deal }: DealCardProps) {
  const [copied, setCopied] = useState(false);
  const daysLeft = getDaysUntilExpiry(deal.expiresAt);
  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
  const isExpired = daysLeft === 0;

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!deal.couponCode) return;

    try {
      await navigator.clipboard.writeText(deal.couponCode);
      setCopied(true);
      toast.success('Copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      {/* Banner area */}
      <div className="relative h-40 bg-gradient-to-br from-primary/20 via-primary/10 to-background overflow-hidden">
        {deal.bannerUrl ? (
          <Image
            src={deal.bannerUrl}
            alt={deal.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-4xl font-bold text-primary/30">
              {getStoreInitials(deal.store.name)}
            </span>
          </div>
        )}

        {/* Type badge - top right */}
        <div className="absolute top-2 right-2">
          <DealTypeBadge type={deal.type} />
        </div>

        {/* Discount badge - bottom left */}
        {deal.discount && (
          <div className="absolute bottom-2 left-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent text-sm px-3 py-1 font-bold">
              {deal.discount}
            </Badge>
          </div>
        )}

        {/* Expiry badge - bottom right */}
        {isExpiringSoon && !isExpired && (
          <div className="absolute bottom-2 right-2">
            <Badge
              variant="outline"
              className="bg-background/80 backdrop-blur-sm border-yellow-500 text-yellow-600 dark:text-yellow-400 text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              Expira em {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}
            </Badge>
          </div>
        )}

        {isExpired && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <Badge variant="destructive" className="text-sm px-4 py-1">
              Expirada
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Store info */}
        <div className="flex items-center gap-2">
          {deal.store.logoUrl ? (
            <Image
              src={deal.store.logoUrl}
              alt={deal.store.name}
              width={20}
              height={20}
              className="rounded-sm object-contain"
            />
          ) : (
            <div className="h-5 w-5 rounded-sm bg-muted flex items-center justify-center">
              <span className="text-[10px] font-bold text-muted-foreground">
                {getStoreInitials(deal.store.name).charAt(0)}
              </span>
            </div>
          )}
          <span className="text-xs text-muted-foreground font-medium">{deal.store.name}</span>
          {deal.category && (
            <>
              <span className="text-muted-foreground/40">|</span>
              <span className="text-xs text-muted-foreground">{deal.category.name}</span>
            </>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
          {deal.title}
        </h3>

        {/* Description */}
        {deal.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{deal.description}</p>
        )}

        {/* Coupon code */}
        {deal.type === 'COUPON' && deal.couponCode && (
          <button
            onClick={handleCopyCode}
            className="w-full flex items-center justify-between gap-2 rounded-md border-2 border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm font-mono font-semibold text-primary hover:border-primary/60 hover:bg-primary/10 transition-colors"
          >
            <span className="truncate">{deal.couponCode}</span>
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="h-4 w-4 shrink-0" />
            )}
          </button>
        )}

        {/* CTA button */}
        <Button
          asChild
          className="w-full"
          size="sm"
          disabled={isExpired}
        >
          <a
            href={getClickUrl(deal.id)}
            target="_blank"
            rel="noopener noreferrer"
            className={isExpired ? 'pointer-events-none opacity-50' : ''}
          >
            Ver oferta
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
