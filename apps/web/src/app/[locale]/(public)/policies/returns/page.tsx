import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Politica de Devolucao — Comics Trunk',
  description: 'Politica de Devolucao da plataforma Comics Trunk.',
};

export default function ReturnsPolicyPage() {
  return (
    <LegalDocumentPage documentType="RETURNS_POLICY" title="Politica de Devolucao" />
  );
}
