'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from './theme-toggle';
import { MobileNav } from './mobile-nav';

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-border/40 gradient-primary">
        <div className="flex h-full items-center justify-between px-4">
          {/* Left: hamburger (mobile) + logo */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white hover:bg-white/10"
              onClick={() => setMobileNavOpen(true)}
              aria-label={t('nav.openMenu')}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 text-white font-bold text-lg hover:opacity-90 transition-opacity"
            >
              <span className="text-xl">{t('common.appName')}</span>
            </Link>
          </div>

          {/* Right: theme toggle + user menu placeholder */}
          <div className="flex items-center gap-2 [&_button]:text-white [&_button]:hover:bg-white/10 [&_button]:hover:text-white">
            <ThemeToggle />
            {/* User menu placeholder - will be added in Phase 2 auth UI */}
          </div>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
    </>
  );
}
