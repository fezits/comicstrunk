'use client';

import { Info } from 'lucide-react';

export function AffiliateDisclosure() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-3">
      <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        Este site pode receber comissao por compras realizadas atraves dos links de afiliados.
        Isso nao afeta o preco que voce paga.
      </p>
    </div>
  );
}
