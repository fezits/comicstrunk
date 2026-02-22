'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
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

  // Filter out admin-only groups for now (role check will be added in Phase 10)
  const visibleGroups = navGroups.filter((group) => !group.adminOnly);

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
        </nav>
      </SheetContent>
    </Sheet>
  );
}
