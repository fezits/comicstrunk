import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Politica de Pagamento — Comics Trunk',
  description: 'Politica de Pagamento da plataforma Comics Trunk.',
};

export default function PaymentPolicyPage() {
  return (
    <LegalDocumentPage documentType="PAYMENT_POLICY" title="Politica de Pagamento" />
  );
}
