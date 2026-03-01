import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Termos de Uso — Comics Trunk',
  description: 'Termos de Uso da plataforma Comics Trunk.',
};

export default function TermsPage() {
  return <LegalDocumentPage documentType="TERMS_OF_USE" title="Termos de Uso" />;
}
