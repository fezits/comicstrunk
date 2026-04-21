'use client';

import { useParams } from 'next/navigation';

import { ListingDetail } from '@/components/features/marketplace/listing-detail';

export default function MarketplaceDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <ListingDetail id={id} />;
}
