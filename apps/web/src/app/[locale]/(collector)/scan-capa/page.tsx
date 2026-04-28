'use client';

import { useTranslations } from 'next-intl';
import { CoverPhotoScanner } from '@/components/features/catalog/cover-photo-scanner';

export default function ScanCapaPage() {
  const t = useTranslations('scanCapa');
  // O scanner agora confirma e salva via modal (POST /cover-scan/confirm).
  // Nao precisamos redirecionar — o usuario pode escanear de novo na hora.
  // onChoose nao eh passado: o scanner se vira, mostra toast e volta ao idle.

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </header>

      <CoverPhotoScanner />

      <footer className="mt-8 text-center text-xs text-muted-foreground/60">
        {t('poweredByMetron')}
      </footer>
    </div>
  );
}
