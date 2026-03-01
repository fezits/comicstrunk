'use client';

import { AdminHomepageSections } from '@/components/features/homepage/admin-homepage-sections';

export default function AdminHomepagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurar Homepage</h1>
        <p className="text-muted-foreground mt-2">
          Configure as secoes que aparecem na pagina inicial. Use as setas para reordenar ou o
          botao de visibilidade para ocultar secoes.
        </p>
      </div>

      <AdminHomepageSections />
    </div>
  );
}
