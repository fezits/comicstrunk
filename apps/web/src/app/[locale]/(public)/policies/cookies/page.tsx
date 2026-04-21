import type { Metadata } from 'next';

import { LegalDocumentPage } from '@/components/features/legal/legal-document-page';

export const metadata: Metadata = {
  title: 'Politica de Cookies — Comics Trunk',
  description: 'Politica de Cookies da plataforma Comics Trunk.',
};

export default function CookiesPolicyPage() {
  return (
    <LegalDocumentPage documentType="COOKIES_POLICY" title="Politica de Cookies" />
  );
}
