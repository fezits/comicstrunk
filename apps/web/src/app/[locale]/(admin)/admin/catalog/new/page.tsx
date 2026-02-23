'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { CreateCatalogEntryInput } from '@comicstrunk/contracts';

import { CatalogForm } from '@/components/features/catalog/catalog-form';
import { createCatalogEntry, uploadCoverImage } from '@/lib/api/admin-catalog';

export default function NewCatalogEntryPage() {
  const t = useTranslations('admin.catalog');
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: CreateCatalogEntryInput, coverFile?: File) => {
    setLoading(true);
    try {
      const entry = await createCatalogEntry(data as Record<string, unknown>);
      if (coverFile) {
        await uploadCoverImage(entry.id, coverFile);
      }
      toast.success(t('createSuccess'));
      router.push(`/${locale}/admin/catalog`);
    } catch {
      toast.error(t('createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('new')}</h1>
      <CatalogForm
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/${locale}/admin/catalog`)}
        loading={loading}
      />
    </div>
  );
}
