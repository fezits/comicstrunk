'use client';

import { AdminDashboard } from '@/components/features/admin/admin-dashboard';

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Painel Administrativo</h1>
      <AdminDashboard />
    </div>
  );
}
