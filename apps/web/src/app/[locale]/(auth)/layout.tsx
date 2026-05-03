import Link from 'next/link';
import { getLocale } from 'next-intl/server';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Logo above the card — clicks to home */}
      <Link
        href={`/${locale}`}
        className="mb-6 inline-flex items-center justify-center transition-opacity hover:opacity-80"
        aria-label="Comics Trunk — voltar para a home"
      >
        <img
          src="/logo-400.png"
          alt="Comics Trunk"
          className="h-16 w-auto sm:h-20"
        />
      </Link>

      {/* Centered card layout for auth pages - no sidebar, no header */}
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
