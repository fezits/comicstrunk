'use client';

import { use } from 'react';
import { AdminUserDetail } from '@/components/features/admin/admin-user-detail';

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Detalhes do Usuario</h1>
      <AdminUserDetail userId={id} />
    </div>
  );
}
