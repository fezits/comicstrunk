'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

type ApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

const statusVariant: Record<ApprovalStatus, 'outline' | 'secondary' | 'default' | 'destructive'> =
  {
    DRAFT: 'outline',
    PENDING: 'secondary',
    APPROVED: 'default',
    REJECTED: 'destructive',
  };

const statusKey: Record<ApprovalStatus, string> = {
  DRAFT: 'drafts',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const t = useTranslations('admin.catalog');

  return <Badge variant={statusVariant[status]}>{t(statusKey[status])}</Badge>;
}
