'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PixPaymentPage } from '@/components/features/checkout/pix-payment-page';

function PaymentLoading() {
  return (
    <div className="max-w-lg mx-auto flex flex-col items-center gap-4 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function PaymentRoute() {
  return (
    <Suspense fallback={<PaymentLoading />}>
      <PixPaymentPage />
    </Suspense>
  );
}
