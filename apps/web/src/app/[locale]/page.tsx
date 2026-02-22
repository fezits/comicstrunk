import { useTranslations } from 'next-intl';
import { CONTRACT_VERSION } from '@comicstrunk/contracts';

export default function Home() {
  const t = useTranslations();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-5xl font-bold gradient-text">
        {t('home.title')}
      </h1>
      <p className="text-xl text-muted-foreground">
        {t('home.subtitle')}
      </p>
      <p className="text-base text-muted-foreground max-w-md text-center">
        {t('home.description')}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Contracts v{CONTRACT_VERSION}
      </p>
    </main>
  );
}
