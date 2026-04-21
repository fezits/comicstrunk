'use client';

import { AdminContactMessages } from '@/components/features/admin/admin-contact-messages';

export default function AdminContactPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Mensagens de Contato</h1>
      <AdminContactMessages />
    </div>
  );
}
