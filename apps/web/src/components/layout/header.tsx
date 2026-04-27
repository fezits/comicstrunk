'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Menu, LogIn, UserPlus, LogOut, ShoppingCart } from 'lucide-react';

import { useAuth } from '@/lib/auth/use-auth';
import { useCart } from '@/contexts/cart-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from './theme-toggle';
import { MobileNav } from './mobile-nav';
import { CartSidebar } from '@/components/features/cart/cart-sidebar';
import { NotificationBell } from '@/components/features/notifications/notification-bell';

export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { cartCount } = useCart();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

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
              <img src="/logo-header.png" alt="Comics Trunk" className="h-8 w-auto" />
              <span className="text-base sm:text-xl">{t('common.appName')}</span>
            </Link>
          </div>

          {/* Right: auth buttons + notifications + cart + theme toggle + user menu */}
          <div className="flex items-center gap-1 sm:gap-2 [&_button]:text-white [&_button]:hover:bg-white/10 [&_button]:hover:text-white">
            {isLoading ? (
              <Skeleton className="h-8 w-20 bg-white/20 rounded-md" />
            ) : isAuthenticated ? (
              <>
                {/* Cart icon with badge */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  onClick={() => setCartOpen(true)}
                  aria-label={t('nav.cart')}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-primary">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Button>

                {/* Notification bell with dropdown */}
                <NotificationBell />

                <ThemeToggle />

                {/* User dropdown menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-8 w-8 rounded-full"
                    >
                      <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex items-center gap-2 p-2">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/${locale}/profile`} className="cursor-pointer">
                        {t('nav.profile')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/${locale}/settings`} className="cursor-pointer">
                        {t('nav.settings')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={() => logout()}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {t('nav.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <ThemeToggle />

                {/* Login and Signup buttons for unauthenticated users */}
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <Link href={`/${locale}/login`}>
                    <LogIn className="h-4 w-4 mr-1.5" />
                    {t('nav.login')}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-white text-primary hover:bg-white/90 hover:text-primary font-semibold"
                >
                  <Link href={`/${locale}/signup`}>
                    <UserPlus className="h-4 w-4 mr-1.5 hidden sm:inline" />
                    {t('nav.signup')}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <CartSidebar open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
