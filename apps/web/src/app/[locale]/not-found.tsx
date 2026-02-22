import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

/**
 * Locale-aware 404 page.
 * Has access to translations and locale context.
 */
export default function LocaleNotFound() {
  const t = useTranslations('notFound');
  const locale = useLocale();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 bg-background text-foreground">
      <h1 className="text-6xl font-bold gradient-text">404</h1>
      <h2 className="text-2xl font-semibold">
        {t('title')}
      </h2>
      <p className="text-muted-foreground text-center max-w-md">
        {t('description')}
      </p>
      <Link
        href={`/${locale}`}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t('backHome')}
      </Link>
    </main>
  );
}
