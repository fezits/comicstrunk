import { useTranslations } from 'next-intl';
import { BookOpen, Users, Star } from 'lucide-react';

export default function Home() {
  const t = useTranslations();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] gap-8">
      {/* Hero section */}
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold gradient-text">
          {t('home.title')}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t('home.subtitle')}
        </p>
        <p className="text-base text-muted-foreground max-w-md mx-auto">
          {t('home.description')}
        </p>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 w-full max-w-3xl">
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card border border-border">
          <div className="p-3 rounded-full bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t('home.featureCatalog')}</h3>
          <p className="text-xs text-muted-foreground text-center">
            {t('home.featureCatalogDesc')}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card border border-border">
          <div className="p-3 rounded-full bg-primary/10">
            <Star className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t('home.featureTrack')}</h3>
          <p className="text-xs text-muted-foreground text-center">
            {t('home.featureTrackDesc')}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-card border border-border">
          <div className="p-3 rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">{t('home.featureConnect')}</h3>
          <p className="text-xs text-muted-foreground text-center">
            {t('home.featureConnectDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}
