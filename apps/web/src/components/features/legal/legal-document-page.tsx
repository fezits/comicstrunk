'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { getLatestDocument, type LegalDocument, type LegalDocumentType } from '@/lib/api/legal';

interface LegalDocumentPageProps {
  documentType: LegalDocumentType;
  title: string;
}

export function LegalDocumentPage({ documentType, title }: LegalDocumentPageProps) {
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocument() {
      try {
        setIsLoading(true);
        setError(null);
        const doc = await getLatestDocument(documentType);
        setDocument(doc);
      } catch {
        setError('Nao foi possivel carregar o documento. Tente novamente mais tarde.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDocument();
  }, [documentType]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">
          {error || 'Documento nao encontrado.'}
        </p>
      </div>
    );
  }

  const effectDate = new Date(document.dateOfEffect).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Versao {document.version}</span>
          <span className="hidden sm:inline">|</span>
          <span>Vigente desde {effectDate}</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
        <div
          className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-foreground
            prose-p:text-muted-foreground
            prose-strong:text-foreground
            prose-li:text-muted-foreground
            prose-a:text-primary hover:prose-a:text-primary/80"
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {document.content}
        </div>
      </div>
    </div>
  );
}
