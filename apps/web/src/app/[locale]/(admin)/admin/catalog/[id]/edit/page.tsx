'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { CreateCatalogEntryInput } from '@comicstrunk/contracts';

import { Skeleton } from '@/components/ui/skeleton';
import { CatalogForm } from '@/components/features/catalog/catalog-form';
import type { CatalogEntry } from '@/lib/api/catalog';
import { getAdminCatalogEntry, updateCatalogEntry, uploadCoverImage } from '@/lib/api/admin-catalog';

export default function EditCatalogEntryPage() {
  const t = useTranslations('admin.catalog');
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<CatalogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAdminCatalogEntry(id)
      .then(setEntry)
      .catch(() => toast.error(t('notFound')))
      .finally(() => setLoading(false));
  }, [id, t]);

  const handleSubmit = async (data: CreateCatalogEntryInput, coverFile?: File) => {
    setSaving(true);
    try {
      await updateCatalogEntry(id, data as Record<string, unknown>);
      if (coverFile) {
        await uploadCoverImage(id, coverFile);
      }
      toast.success(t('saveSuccess'));
      router.push(`/${locale}/admin/catalog`);
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!entry) {
    return <p className="text-center text-muted-foreground py-8">{t('notFound')}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('edit')}</h1>
      <CatalogForm
        entry={entry}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/${locale}/admin/catalog`)}
        loading={saving}
      />
    </div>
  );
}
