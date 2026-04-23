import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { CartProvider } from '@/contexts/cart-context';
import { CollectionProvider } from '@/contexts/collection-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { CookieConsentBanner } from '@/components/features/legal/cookie-consent-banner';
import { QueryProvider } from '@/components/providers/query-provider';
import '@/styles/globals.css';

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <QueryProvider>
          <AuthProvider>
            <CartProvider>
              <CollectionProvider>
                <NotificationProvider>
                  {children}
                  <CookieConsentBanner />
                </NotificationProvider>
              </CollectionProvider>
            </CartProvider>
          </AuthProvider>
        </QueryProvider>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: 'font-sans',
            },
          }}
        />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
