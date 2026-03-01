'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  adminListSubscriptions,
  adminActivateSubscription,
  type AdminSubscription,
  type PaginationMeta,
} from '@/lib/api/admin-subscriptions';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getStatusBadgeVariant(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'TRIALING':
      return 'secondary';
    case 'PAST_DUE':
      return 'outline';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'outline';
  }
}

const STATUS_OPTIONS = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED'] as const;
const PLAN_TYPE_OPTIONS = ['FREE', 'BASIC'] as const;

export function SubscriptionList() {
  const t = useTranslations('adminSubscription');
  const tCommon = useTranslations('common');

  // Data state
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [planTypeFilter, setPlanTypeFilter] = useState<string>('');

  // Activation dialog state
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateUserId, setActivateUserId] = useState('');
  const [activatePlanType, setActivatePlanType] = useState('BASIC');
  const [activateDuration, setActivateDuration] = useState(30);
  const [activateLoading, setActivateLoading] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (planTypeFilter) params.planType = planTypeFilter;

      const res = await adminListSubscriptions(params);
      setSubscriptions(res.data);
      setPagination(res.pagination);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, planTypeFilter, tCommon]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleActivate = async () => {
    if (!activateUserId.trim()) return;
    setActivateLoading(true);
    try {
      await adminActivateSubscription({
        userId: activateUserId.trim(),
        planType: activatePlanType,
        durationDays: activateDuration,
      });
      toast.success(t('activate.success'));
      setActivateOpen(false);
      setActivateUserId('');
      setActivatePlanType('BASIC');
      setActivateDuration(30);
      fetchSubscriptions();
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setActivateLoading(false);
    }
  };

  const openActivateForUser = (userId: string) => {
    setActivateUserId(userId);
    setActivateOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">{t('filters.status')}:</Label>
          <Select
            value={statusFilter || 'ALL'}
            onValueChange={(val) => {
              setStatusFilter(val === 'ALL' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('filters.all')}</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">{t('filters.planType')}:</Label>
          <Select
            value={planTypeFilter || 'ALL'}
            onValueChange={(val) => {
              setPlanTypeFilter(val === 'ALL' ? '' : val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('filters.all')}</SelectItem>
              {PLAN_TYPE_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button onClick={() => setActivateOpen(true)}>{t('activate.title')}</Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{t('noSubscriptions')}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.user')}</TableHead>
                <TableHead>{t('table.email')}</TableHead>
                <TableHead>{t('table.plan')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.periodEnd')}</TableHead>
                <TableHead>{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sub.user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sub.planType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(sub.status)}>
                      {t(`status.${sub.status}` as 'status.ACTIVE' | 'status.TRIALING' | 'status.PAST_DUE' | 'status.CANCELLED')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(sub.currentPeriodEnd)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openActivateForUser(sub.userId)}
                    >
                      {t('activate.submit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t('previousPage')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('nextPage')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Activation Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('activate.title')}</DialogTitle>
            <DialogDescription>{t('activate.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('activate.userId')}</Label>
              <Input
                value={activateUserId}
                onChange={(e) => setActivateUserId(e.target.value)}
                placeholder="cuid..."
              />
            </div>

            <div className="space-y-2">
              <Label>{t('activate.planType')}</Label>
              <Select value={activatePlanType} onValueChange={setActivatePlanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TYPE_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('activate.duration')}</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={activateDuration}
                onChange={(e) => setActivateDuration(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleActivate} disabled={activateLoading || !activateUserId.trim()}>
              {activateLoading ? t('activate.submitting') : t('activate.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
