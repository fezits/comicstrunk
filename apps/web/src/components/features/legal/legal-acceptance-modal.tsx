'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { acceptDocument, type LegalDocument } from '@/lib/api/legal';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TERMS_OF_USE: 'Termos de Uso',
  PRIVACY_POLICY: 'Politica de Privacidade',
  SELLER_TERMS: 'Termos do Vendedor',
  PAYMENT_POLICY: 'Politica de Pagamento',
  RETURNS_POLICY: 'Politica de Devolucao',
  SHIPPING_POLICY: 'Politica de Envio',
  CANCELLATION_POLICY: 'Politica de Cancelamento',
  COOKIES_POLICY: 'Politica de Cookies',
};

interface LegalAcceptanceModalProps {
  document: LegalDocument;
  open: boolean;
  onAccepted: () => void;
}

export function LegalAcceptanceModal({
  document,
  open,
  onAccepted,
}: LegalAcceptanceModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = DOCUMENT_TYPE_LABELS[document.type] || document.type;

  async function handleConfirm() {
    if (!accepted) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await acceptDocument(document.id);
      onAccepted();
    } catch {
      setError('Erro ao registrar aceite. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Versao {document.version} — Por favor, leia e aceite para continuar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] rounded-md border border-border p-4">
          <div
            className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:text-foreground
              prose-p:text-muted-foreground
              prose-strong:text-foreground
              prose-li:text-muted-foreground"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {document.content}
          </div>
        </ScrollArea>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-center space-x-2">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
          />
          <label
            htmlFor="accept-terms"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Li e aceito os termos
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!accepted || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              'Confirmar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
