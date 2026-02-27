'use client';

import { useParams } from 'next/navigation';
import { OrderDetailPage } from '@/components/features/orders/order-detail-page';

export default function OrderDetailRoute() {
  const params = useParams();
  const id = params.id as string;

  return <OrderDetailPage orderId={id} />;
}
