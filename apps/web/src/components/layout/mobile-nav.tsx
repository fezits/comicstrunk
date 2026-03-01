'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, LogIn, UserPlus, LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { navGroups, type NavGroup } from './nav-config';

function MobileNavGroup({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{t(group.labelKey)}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 transition-transform duration-200',
            isOpen ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>
      {isOpen && (
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const href = `/${locale}${item.href}`;
            const isActive =
              pathname === href ||
              (item.href !== '/' && pathname.startsWith(href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(item.titleKey)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { user, isAuthenticated, logout } = useAuth();

  // Filter groups based on auth state and role
  const visibleGroups = navGroups.filter((group) => {
    if (group.adminOnly && user?.role !== 'ADMIN') return false;
    if (group.requiresAuth && !isAuthenticated) return false;
    return true;
  });

  const handleNavigate = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="gradient-text text-lg font-bold">
            {t('common.appName')}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('nav.openMenu')}
          </SheetDescription>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleGroups.map((group, index) => (
            <div key={group.labelKey}>
              {index > 0 && <Separator className="my-2" />}
              <MobileNavGroup group={group} onNavigate={handleNavigate} />
            </div>
          ))}

          {/* Auth section */}
          <Separator className="my-3" />

          {isAuthenticated ? (
            <div className="space-y-2 px-3">
              <div className="flex items-center gap-2 py-1">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground hover:text-destructive"
                onClick={() => {
                  logout();
                  handleNavigate();
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {t('nav.logout')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 px-3">
              <Button
                asChild
                className="w-full gradient-primary text-white"
                size="sm"
              >
                <Link href={`/${locale}/login`} onClick={handleNavigate}>
                  <LogIn className="h-4 w-4 mr-2" />
                  {t('nav.login')}
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Link href={`/${locale}/signup`} onClick={handleNavigate}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('nav.signup')}
                </Link>
              </Button>
            </div>
          )}

          {/* Legal / policy links */}
          <Separator className="my-3" />
          <div className="px-3 flex flex-wrap gap-x-3 gap-y-1">
            <Link
              href={`/${locale}/terms`}
              onClick={handleNavigate}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Termos
            </Link>
            <Link
              href={`/${locale}/privacy`}
              onClick={handleNavigate}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacidade
            </Link>
            <Link
              href={`/${locale}/policies`}
              onClick={handleNavigate}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Politicas
            </Link>
          </div>

          <p className="px-3 mt-2 text-xs text-muted-foreground">
            {t('common.appName')} &copy; {new Date().getFullYear()}
          </p>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
