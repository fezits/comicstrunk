'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  Eye,
  EyeOff,
  Tag,
  Trash2,
  Edit2,
  Check,
  X,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getCollectionItem,
  updateCollectionItem,
  deleteCollectionItem,
  markAsRead,
  markForSale,
  type CollectionItem,
  type ItemCondition,
} from '@/lib/api/collection';

const CONDITIONS: ItemCondition[] = ['NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'];

const conditionColors: Record<ItemCondition, string> = {
  NEW: 'bg-green-500/10 text-green-600 border-green-500/20',
  VERY_GOOD: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  GOOD: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  FAIR: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  POOR: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function CollectionItemDetailPage() {
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<CollectionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editPricePaid, setEditPricePaid] = useState('');
  const [editCondition, setEditCondition] = useState<ItemCondition>('NEW');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Sale dialog
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [salePrice, setSalePrice] = useState('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchItem = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getCollectionItem(id);
      setItem(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const startEditing = () => {
    if (!item) return;
    setEditQuantity(item.quantity);
    setEditPricePaid(item.pricePaid != null ? String(item.pricePaid) : '');
    setEditCondition(item.condition);
    setEditNotes(item.notes ?? '');
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await updateCollectionItem(item.id, {
        quantity: editQuantity,
        pricePaid: editPricePaid ? Number(editPricePaid) : null,
        condition: editCondition,
        notes: editNotes || null,
      });
      setItem(updated);
      setEditing(false);
      toast.success(t('updateSuccess'));
    } catch {
      toast.error(t('updateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRead = async () => {
    if (!item) return;
    try {
      const updated = await markAsRead(item.id, !item.isRead);
      setItem(updated);
      toast.success(updated.isRead ? t('markedAsRead') : t('markedAsUnread'));
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleMarkForSale = async () => {
    if (!item) return;
    if (item.isForSale) {
      // Remove from sale
      try {
        const updated = await markForSale(item.id, { isForSale: false });
        setItem(updated);
        toast.success(t('removedFromSale'));
      } catch {
        toast.error(tCommon('error'));
      }
    } else {
      // Open sale dialog
      setSalePrice('');
      setSaleDialogOpen(true);
    }
  };

  const handleConfirmSale = async () => {
    if (!item) return;
    try {
      const updated = await markForSale(item.id, {
        isForSale: true,
        salePrice: salePrice ? Number(salePrice) : undefined,
      });
      setItem(updated);
      setSaleDialogOpen(false);
      toast.success(t('markedForSale'));
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await deleteCollectionItem(item.id);
      toast.success(t('deleteSuccess'));
      router.push(`/${locale}/collection`);
    } catch {
      toast.error(t('deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  if (notFound || !item) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold">{t('notFound')}</h2>
        <p className="text-muted-foreground">{t('notFoundDescription')}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/collection`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToCollection')}
          </Link>
        </Button>
      </div>
    );
  }

  const entry = item.catalogEntry;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${locale}/collection`}
          className="hover:text-foreground transition-colors"
        >
          {t('title')}
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{entry.title}</span>
      </nav>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Cover */}
        <div className="shrink-0 mx-auto md:mx-0">
          <div className="w-64 aspect-[2/3] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {entry.coverImageUrl ? (
              <img
                src={entry.coverImageUrl}
                alt={entry.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <BookOpen className="h-16 w-16 text-muted-foreground/40" />
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">{entry.title}</h1>

          {/* Author & Publisher */}
          <div className="space-y-1.5">
            {entry.author && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">{t('detail.author')}:</span>
                <span>{entry.author}</span>
              </div>
            )}
            {entry.publisher && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">{t('detail.publisher')}:</span>
                <span>{entry.publisher}</span>
              </div>
            )}
            {entry.series && (
              <div className="flex gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">{t('detail.series')}:</span>
                <span>{entry.series.title}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Collection info (view or edit) */}
          {editing ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('detail.editInfo')}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('form.quantity')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('form.pricePaid')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={editPricePaid}
                    onChange={(e) => setEditPricePaid(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('form.condition')}</Label>
                <Select
                  value={editCondition}
                  onValueChange={(v) => setEditCondition(v as ItemCondition)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`condition.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('form.notes')}</Label>
                <Textarea
                  placeholder={t('form.notesPlaceholder')}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} disabled={saving}>
                  <Check className="h-4 w-4 mr-2" />
                  {saving ? tCommon('loading') : tCommon('save')}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4 mr-2" />
                  {tCommon('cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">{t('detail.collectionInfo')}</h2>

              <div className="space-y-2">
                <div className="flex gap-2 text-sm">
                  <span className="text-muted-foreground shrink-0">{t('form.quantity')}:</span>
                  <span>{item.quantity}</span>
                </div>
                {item.pricePaid != null && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{t('form.pricePaid')}:</span>
                    <span>{formatCurrency(item.pricePaid)}</span>
                  </div>
                )}
                <div className="flex gap-2 text-sm items-center">
                  <span className="text-muted-foreground shrink-0">
                    {t('form.condition')}:
                  </span>
                  <Badge variant="outline" className={conditionColors[item.condition]}>
                    {t(`condition.${item.condition}`)}
                  </Badge>
                </div>
                {item.notes && (
                  <div className="flex gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{t('form.notes')}:</span>
                    <span className="whitespace-pre-line">{item.notes}</span>
                  </div>
                )}
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={item.isRead ? 'default' : 'outline'}>
                  {item.isRead ? (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      {t('readBadge')}
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      {t('unreadBadge')}
                    </>
                  )}
                </Badge>
                {item.isForSale && (
                  <Badge className="bg-green-600 hover:bg-green-700">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {item.salePrice ? formatCurrency(item.salePrice) : t('forSaleBadge')}
                  </Badge>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  {tCommon('edit')}
                </Button>
                <Button variant="outline" size="sm" onClick={handleToggleRead}>
                  {item.isRead ? (
                    <EyeOff className="h-4 w-4 mr-2" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  {item.isRead ? t('markUnread') : t('markRead')}
                </Button>
                <Button variant="outline" size="sm" onClick={handleMarkForSale}>
                  <Tag className="h-4 w-4 mr-2" />
                  {item.isForSale ? t('removeSale') : t('markForSale')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {tCommon('delete')}
                </Button>
              </div>
            </div>
          )}

          {/* Catalog description */}
          {entry.description && (
            <>
              <Separator />
              <div>
                <h2 className="text-lg font-semibold mb-2">{t('detail.description')}</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {entry.description}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sale dialog */}
      <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('saleDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('saleDialog.price')}</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0.00"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('saleDialog.priceHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleConfirmSale}>
              {t('saleDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('deleteDialog.description')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? tCommon('loading') : tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
