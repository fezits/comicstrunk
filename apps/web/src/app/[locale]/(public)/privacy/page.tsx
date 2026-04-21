import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Politica de Privacidade — Comics Trunk',
  description: 'Politica de Privacidade da plataforma Comics Trunk.',
};

export default function PrivacyPage() {
  return (
    <LegalDocumentPage documentType="PRIVACY_POLICY" title="Politica de Privacidade" />
  );
}
