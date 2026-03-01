import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { CartProvider } from '@/contexts/cart-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { CookieConsentBanner } from '@/components/features/legal/cookie-consent-banner';
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

  // Load messages for the requested locale
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <AuthProvider>
          <CartProvider>
            <NotificationProvider>
              {children}
              <CookieConsentBanner />
            </NotificationProvider>
          </CartProvider>
        </AuthProvider>
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
