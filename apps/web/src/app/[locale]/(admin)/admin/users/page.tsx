'use client';

import { AdminUserManagement } from '@/components/features/admin/admin-user-management';

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Gerenciar Usuarios</h1>
      <AdminUserManagement />
    </div>
  );
}
