'use client';

import { useParams } from 'next/navigation';
import { DisputeDetailPage } from '@/components/features/disputes/dispute-detail-page';

export default function DisputeDetailRoute() {
  const params = useParams();
  const id = params.id as string;

  return <DisputeDetailPage disputeId={id} />;
}
