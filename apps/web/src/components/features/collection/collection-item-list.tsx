'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BookOpen, Eye, EyeOff, Tag, DollarSign } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CollectionItem, ItemCondition } from '@/lib/api/collection';

interface CollectionItemListProps {
  item: CollectionItem;
  onToggleRead?: (id: string, isRead: boolean) => void;
  onToggleSale?: (id: string) => void;
}

const conditionColors: Record<ItemCondition, string> = {
  NEW: 'bg-green-500/10 text-green-600 border-green-500/20',
  VERY_GOOD: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  GOOD: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  FAIR: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  POOR: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export function CollectionItemList({ item, onToggleRead, onToggleSale }: CollectionItemListProps) {
  const locale = useLocale();
  const t = useTranslations('collection');
  const entry = item.catalogEntry;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors${item.isRead ? ' border-l-4 border-l-green-500' : ''}`}>
      {/* Cover thumbnail */}
      <Link href={`/${locale}/collection/${item.id}`} className="shrink-0">
        <div className="w-12 h-16 bg-muted rounded overflow-hidden">
          {entry.coverImageUrl ? (
            <img
              src={entry.coverImageUrl}
              alt={entry.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-muted-foreground/40" />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/${locale}/collection/${item.id}`}>
          <p className="font-medium text-sm truncate hover:text-primary transition-colors">
            {entry.title}
          </p>
        </Link>
        <p className="text-xs text-muted-foreground truncate">
          {[entry.author, entry.publisher].filter(Boolean).join(' — ')}
        </p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${conditionColors[item.condition]}`}>
            {t(`condition.${item.condition}`)}
          </Badge>
          {entry.series && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {entry.series.title}
            </Badge>
          )}
          {item.isForSale && item.salePrice && (
            <Badge className="text-[10px] px-1.5 py-0 bg-green-600">
              <DollarSign className="h-2.5 w-2.5 mr-0.5" />
              {formatCurrency(item.salePrice)}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={item.isRead ? t('markUnread') : t('markRead')}
          onClick={() => onToggleRead?.(item.id, !item.isRead)}
        >
          {item.isRead ? (
            <Eye className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={item.isForSale ? t('removeSale') : t('markForSale')}
          onClick={() => onToggleSale?.(item.id)}
        >
          <Tag className={`h-3.5 w-3.5 ${item.isForSale ? 'text-green-500' : 'text-muted-foreground'}`} />
        </Button>
      </div>
    </div>
  );
}
