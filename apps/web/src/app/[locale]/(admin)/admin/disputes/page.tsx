'use client';

import { AdminDisputeStats } from '@/components/features/disputes/admin-dispute-stats';
import { AdminDisputeQueue } from '@/components/features/disputes/admin-dispute-queue';

export default function AdminDisputesPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">
        Gerenciar Disputas
      </h1>

      <AdminDisputeStats />

      <div>
        <h2 className="text-xl font-semibold mb-4">Fila de Disputas</h2>
        <AdminDisputeQueue />
      </div>
    </div>
  );
}
