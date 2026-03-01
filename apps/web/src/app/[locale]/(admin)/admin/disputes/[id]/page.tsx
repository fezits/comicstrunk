'use client';

import { useParams } from 'next/navigation';
import { AdminDisputeDetail } from '@/components/features/disputes/admin-dispute-detail';

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <AdminDisputeDetail disputeId={id} />;
}
