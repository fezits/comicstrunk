'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { User, Bell, Crown, Shield, MapPin, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface SettingsLink {
  titleKey: string;
  descriptionKey: string;
  href: string;
  icon: LucideIcon;
}

const SETTINGS_LINKS: SettingsLink[] = [
  { titleKey: 'profile', descriptionKey: 'profileDescription', href: '/profile', icon: User },
  {
    titleKey: 'notifications',
    descriptionKey: 'notificationsDescription',
    href: '/notifications/preferences',
    icon: Bell,
  },
  {
    titleKey: 'subscription',
    descriptionKey: 'subscriptionDescription',
    href: '/subscription',
    icon: Crown,
  },
  { titleKey: 'privacy', descriptionKey: 'privacyDescription', href: '/lgpd', icon: Shield },
  { titleKey: 'addresses', descriptionKey: 'addressesDescription', href: '/addresses', icon: MapPin },
];

export function SettingsPage() {
  const t = useTranslations('settings');
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={`/${locale}${link.href}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t(link.titleKey)}</p>
                    <p className="text-sm text-muted-foreground">{t(link.descriptionKey)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
