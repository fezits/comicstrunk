'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, LogIn, UserPlus, LogOut } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { navGroups, type NavGroup } from './nav-config';
import { useCollection } from '@/contexts/collection-context';

function NavGroupSection({ group, collectionCount }: { group: NavGroup; collectionCount?: number }) {
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
            const isActive = pathname === href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{t(item.titleKey)}</span>
                {item.href === '/collection' && collectionCount != null && collectionCount > 0 && (
                  <span className="ml-auto text-xs bg-primary/15 text-primary font-semibold px-2 py-0.5 rounded">
                    {collectionCount.toLocaleString('pt-BR')}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { collectionCount } = useCollection();

  // Filter groups based on auth state and role
  const visibleGroups = navGroups.filter((group) => {
    if (group.adminOnly && user?.role !== 'ADMIN') return false;
    if (group.requiresAuth && !isAuthenticated) return false;
    return true;
  });

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:top-16 lg:left-0 lg:z-30 border-r border-border bg-card">
      <div className="flex flex-col flex-1 overflow-y-auto px-3 py-4">
        <nav className="flex-1 space-y-1">
          {visibleGroups.map((group, index) => (
            <div key={group.labelKey}>
              {index > 0 && <Separator className="my-2" />}
              <NavGroupSection group={group} collectionCount={collectionCount} />
            </div>
          ))}
        </nav>

        {/* Auth section at bottom of sidebar */}
        <div className="mt-auto pt-4">
          <Separator className="mb-4" />

          {isLoading ? (
            <div className="space-y-2 px-3">
              <Skeleton className="h-9 w-full" />
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-2 px-3">
              <div className="flex items-center gap-2 px-0 py-1">
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
                onClick={() => logout()}
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
                <Link href={`/${locale}/login`}>
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
                <Link href={`/${locale}/signup`}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('nav.signup')}
                </Link>
              </Button>
            </div>
          )}

          {/* Legal / policy links */}
          <div className="px-3 mt-4 flex flex-wrap gap-x-3 gap-y-1">
            <Link
              href={`/${locale}/terms`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Termos
            </Link>
            <Link
              href={`/${locale}/privacy`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacidade
            </Link>
            <Link
              href={`/${locale}/policies`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Politicas
            </Link>
          </div>

          <p className="px-3 mt-2 text-xs text-muted-foreground">
            {t('common.appName')} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </aside>
  );
}
