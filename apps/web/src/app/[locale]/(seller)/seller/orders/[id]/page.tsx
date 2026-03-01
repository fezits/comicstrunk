'use client';

import { useParams } from 'next/navigation';
import { SellerOrderDetail } from '@/components/features/orders/seller-order-detail';

export default function SellerOrderDetailRoute() {
  const params = useParams();
  const id = params.id as string;

  return <SellerOrderDetail orderId={id} />;
}
