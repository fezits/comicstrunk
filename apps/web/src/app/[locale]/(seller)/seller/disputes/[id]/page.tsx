'use client';

import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { DisputeDetailPage } from '@/components/features/disputes/dispute-detail-page';

export default function SellerDisputeDetailRoute() {
  const params = useParams();
  const locale = useLocale();
  const id = params.id as string;

  return (
    <DisputeDetailPage
      disputeId={id}
      backUrl={`/${locale}/seller/disputes`}
    />
  );
}
