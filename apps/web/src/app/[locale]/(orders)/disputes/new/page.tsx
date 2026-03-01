'use client';

import { useSearchParams } from 'next/navigation';
import { CreateDisputeForm } from '@/components/features/disputes/create-dispute-form';

export default function NewDisputeRoute() {
  const searchParams = useSearchParams();
  const orderItemId = searchParams.get('orderItemId') ?? '';

  if (!orderItemId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <h2 className="text-2xl font-bold">Item nao especificado</h2>
        <p className="text-muted-foreground">
          Voce precisa selecionar um item de pedido para abrir uma disputa.
        </p>
      </div>
    );
  }

  return <CreateDisputeForm orderItemId={orderItemId} />;
}
