'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { CoverPhotoScanner } from '@/components/features/catalog/cover-photo-scanner';
import type { CoverScanCandidate } from '@comicstrunk/contracts';

export default function ScanCapaPage() {
  const t = useTranslations('scanCapa');
  const locale = useLocale();
  const router = useRouter();

  function handleChoose(candidate: CoverScanCandidate) {
    const ref = candidate.slug ?? candidate.id;
    router.push(`/${locale}/catalog/${ref}`);
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <CoverPhotoScanner onChoose={handleChoose} />

      <footer className="mt-8 text-center text-xs text-muted-foreground/60">
        {t('poweredByMetron')}
      </footer>
    </div>
  );
}
