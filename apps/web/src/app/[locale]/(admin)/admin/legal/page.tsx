'use client';

import { AdminLegalDocuments } from '@/components/features/admin/admin-legal-documents';

export default function AdminLegalPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Documentos Legais</h1>
      <AdminLegalDocuments />
    </div>
  );
}
