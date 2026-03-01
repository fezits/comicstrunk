import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Politica de Cancelamento — Comics Trunk',
  description: 'Politica de Cancelamento da plataforma Comics Trunk.',
};

export default function CancellationPolicyPage() {
  return (
    <LegalDocumentPage
      documentType="CANCELLATION_POLICY"
      title="Politica de Cancelamento"
    />
  );
}
