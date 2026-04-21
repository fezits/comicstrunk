'use client';

import { AdminLgpdRequests } from '@/components/features/admin/admin-lgpd-requests';

export default function AdminLgpdPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Solicitacoes LGPD</h1>
      <AdminLgpdRequests />
    </div>
  );
}
