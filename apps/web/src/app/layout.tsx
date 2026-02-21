import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Comics Trunk',
  description: 'A platform for comic book collectors in Brazil',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
