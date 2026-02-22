import Link from 'next/link';

/**
 * Root-level 404 page (no locale context available).
 * This catches requests that don't match any locale prefix.
 */
export default function RootNotFound() {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased bg-background text-foreground">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold">
            Pagina nao encontrada
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            A pagina que voce esta procurando nao existe ou foi movida.
          </p>
          <Link
            href="/pt-BR"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao inicio
          </Link>
        </main>
      </body>
    </html>
  );
}
