import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Politica de Envio — Comics Trunk',
  description: 'Politica de Envio da plataforma Comics Trunk.',
};

export default function ShippingPolicyPage() {
  return (
    <LegalDocumentPage documentType="SHIPPING_POLICY" title="Politica de Envio" />
  );
}
