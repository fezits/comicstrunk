'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Search, BookOpen, Upload, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  searchCatalog,
  type CatalogEntry,
} from '@/lib/api/catalog';
import {
  addCollectionItem,
  importCollection,
  getCSVTemplate,
  type ItemCondition,
} from '@/lib/api/collection';

const CONDITIONS: ItemCondition[] = ['NEW', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'];

export default function AddCollectionItemPage() {
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isImportMode = searchParams.get('mode') === 'import';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection state
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);

  // Form state
  const [quantity, setQuantity] = useState(1);
  const [pricePaid, setPricePaid] = useState('');
  const [condition, setCondition] = useState<ItemCondition>('NEW');
  const [notes, setNotes] = useState('');
  const [isRead, setIsRead] = useState(false);
  const [saving, setSaving] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!value.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchCatalog({ title: value, limit: 12 });
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const handleSelectEntry = (entry: CatalogEntry) => {
    setSelectedEntry(entry);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedEntry) return;
    setSaving(true);
    try {
      await addCollectionItem({
        catalogEntryId: selectedEntry.id,
        quantity,
        pricePaid: pricePaid ? Number(pricePaid) : undefined,
        condition,
        notes: notes || undefined,
        isRead,
      });
      toast.success(t('addSuccess'));
      router.push(`/${locale}/collection`);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
      };
      const message = axiosError?.response?.data?.error?.message || '';

      if (axiosError?.response?.status === 400 && message.includes('Collection limit reached')) {
        toast.error(t('planLimitMessage'), {
          description: t('planLimitUpgrade'),
          duration: 8000,
        });
      } else {
        toast.error(t('addError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const result = await importCollection(importFile);
      if (result.errors.length > 0) {
        toast.warning(
          t('importPartial', { imported: result.imported, errors: result.errors.length }),
        );
      } else {
        toast.success(t('importSuccess', { count: result.imported }));
      }
      router.push(`/${locale}/collection`);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
      };
      const message = axiosError?.response?.data?.error?.message || '';

      if (axiosError?.response?.status === 400 && message.includes('Collection limit reached')) {
        toast.error(t('planLimitMessage'), {
          description: t('planLimitUpgrade'),
          duration: 8000,
        });
      } else {
        toast.error(t('importError'));
      }
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await getCSVTemplate();
      toast.success(t('templateDownloaded'));
    } catch {
      toast.error(tCommon('error'));
    }
  };

  // Import mode view
  if (isImportMode) {
    return (
      <div className="space-y-6 max-w-2xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={`/${locale}/collection`}
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('title')}
          </Link>
          <span>/</span>
          <span className="text-foreground">{t('import')}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight">{t('importTitle')}</h1>

        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t('importHint')}</p>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                {t('downloadTemplate')}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>{t('csvFile')}</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleImport}
                disabled={!importFile || importing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing ? t('importing') : t('import')}
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${locale}/collection`}>{tCommon('cancel')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${locale}/collection`}
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('title')}
        </Link>
        <span>/</span>
        <span className="text-foreground">{t('addItem')}</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight">{t('addItem')}</h1>

      {/* Search or Selected entry */}
      {!selectedEntry ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('searchCatalog')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchCatalogPlaceholder')}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Search results */}
          {searching ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[2/4] rounded-xl" />
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map((entry) => (
                <Card
                  key={entry.id}
                  className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg hover:ring-2 hover:ring-primary"
                  onClick={() => handleSelectEntry(entry)}
                >
                  <div className="aspect-[2/3] bg-muted flex items-center justify-center overflow-hidden">
                    {entry.coverImageUrl ? (
                      <img
                        src={entry.coverImageUrl}
                        alt={entry.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-2">{entry.title}</h3>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {[entry.author, entry.publisher].filter(Boolean).join(' — ')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchQuery && !searching ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('noSearchResults')}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Selected entry preview */}
          <Card>
            <CardContent className="p-4 flex gap-4 items-start">
              <div className="w-20 aspect-[2/3] bg-muted rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                {selectedEntry.coverImageUrl ? (
                  <img
                    src={selectedEntry.coverImageUrl}
                    alt={selectedEntry.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookOpen className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{selectedEntry.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {[selectedEntry.author, selectedEntry.publisher].filter(Boolean).join(' — ')}
                </p>
                {selectedEntry.series && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedEntry.series.title}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEntry(null)}
              >
                {t('changeEntry')}
              </Button>
            </CardContent>
          </Card>

          {/* Collection form */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('form.quantity')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('form.pricePaid')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={pricePaid}
                    onChange={(e) => setPricePaid(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('form.condition')}</Label>
                <Select value={condition} onValueChange={(v) => setCondition(v as ItemCondition)}>
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-read"
                  checked={isRead}
                  onCheckedChange={(checked) => setIsRead(checked === true)}
                />
                <Label htmlFor="is-read" className="cursor-pointer">
                  {t('form.isRead')}
                </Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? tCommon('loading') : t('addItem')}
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/${locale}/collection`}>{tCommon('cancel')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
