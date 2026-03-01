import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Termos do Vendedor — Comics Trunk',
  description: 'Termos e condicoes para vendedores na plataforma Comics Trunk.',
};

export default function SellerTermsPage() {
  return <LegalDocumentPage documentType="SELLER_TERMS" title="Termos do Vendedor" />;
}
