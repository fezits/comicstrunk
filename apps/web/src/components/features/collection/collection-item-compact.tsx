'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Eye, DollarSign } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { CollectionItem, ItemCondition } from '@/lib/api/collection';

interface CollectionItemCompactProps {
  item: CollectionItem;
}

const conditionColors: Record<ItemCondition, string> = {
  NEW: 'bg-green-500/10 text-green-600 border-green-500/20',
  VERY_GOOD: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  GOOD: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  FAIR: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  POOR: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function CollectionItemCompact({ item }: CollectionItemCompactProps) {
  const locale = useLocale();
  const t = useTranslations('collection');
  const entry = item.catalogEntry;

  return (
    <Link
      href={`/${locale}/collection/${item.id}`}
      className="group block rounded-lg border overflow-hidden hover:border-primary/50 transition-colors"
    >
      {/* Cover - smaller */}
      <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden relative">
        {entry.coverImageUrl ? (
          <img
            src={entry.coverImageUrl}
            alt={entry.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
        )}

        {/* Status indicators */}
        <div className="absolute top-1 right-1 flex flex-col gap-0.5">
          {item.isRead && (
            <div className="bg-green-500/80 text-white rounded-full p-0.5">
              <Eye className="h-2.5 w-2.5" />
            </div>
          )}
          {item.isForSale && (
            <div className="bg-green-600/80 text-white rounded-full p-0.5">
              <DollarSign className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
      </div>

      {/* Info - minimal */}
      <div className="p-1.5 space-y-0.5">
        <p className="text-xs font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
          {entry.title}
        </p>
        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${conditionColors[item.condition]}`}>
          {t(`condition.${item.condition}`)}
        </Badge>
      </div>
    </Link>
  );
}
