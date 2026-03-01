'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Cookie } from 'lucide-react';

import { Button } from '@/components/ui/button';

const COOKIE_CONSENT_KEY = 'cookieConsent';

export function CookieConsentBanner() {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm shadow-lg">
      <div className="container mx-auto flex flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:gap-4">
        <Cookie className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
        <p className="flex-1 text-center text-sm text-muted-foreground sm:text-left">
          Este site usa cookies para melhorar sua experiencia. Ao continuar navegando,
          voce concorda com nossa{' '}
          <Link
            href={`/${locale}/policies/cookies`}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Politica de Cookies
          </Link>
          .
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/policies/cookies`}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Saiba mais
          </Link>
          <Button size="sm" onClick={handleAccept}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
