'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PendingPaymentsTable } from './pending-payments-table';
import { PaymentApprovalDialog } from './payment-approval-dialog';
import type {
  PendingPaymentOrder,
  AdminPayment,
  PaginationMeta,
} from '@/lib/api/admin-payments';
import {
  getAdminPendingPayments,
  getAdminAllPayments,
  adminApprovePayment,
  adminRejectPayment,
} from '@/lib/api/admin-payments';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'pending':
    case 'in_process':
      return 'secondary';
    case 'rejected':
    case 'cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: string | null, t: ReturnType<typeof useTranslations>): string {
  switch (status) {
    case 'approved':
      return t('statusApproved');
    case 'pending':
    case 'in_process':
      return t('statusPending');
    case 'rejected':
    case 'cancelled':
      return t('statusRejected');
    case 'refunded':
      return t('statusRefunded');
    default:
      return status ?? '-';
  }
}

export function AdminPaymentsPage() {
  const t = useTranslations('adminPayments');
  const tCommon = useTranslations('common');

  // Pending tab state
  const [pendingOrders, setPendingOrders] = useState<PendingPaymentOrder[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // All tab state
  const [allPayments, setAllPayments] = useState<AdminPayment[]>([]);
  const [allPagination, setAllPagination] = useState<PaginationMeta | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allPage, setAllPage] = useState(1);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'approve' | 'reject'>('approve');
  const [dialogOrderId, setDialogOrderId] = useState('');
  const [dialogOrderNumber, setDialogOrderNumber] = useState('');
  const [dialogAmount, setDialogAmount] = useState(0);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('pending');

  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await getAdminPendingPayments();
      setPendingOrders(res.data);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setPendingLoading(false);
    }
  }, [tCommon]);

  const fetchAll = useCallback(async () => {
    setAllLoading(true);
    try {
      const res = await getAdminAllPayments({ page: allPage, limit: 20 });
      setAllPayments(res.data);
      setAllPagination(res.pagination);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setAllLoading(false);
    }
  }, [allPage, tCommon]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (activeTab === 'all') {
      fetchAll();
    }
  }, [activeTab, fetchAll]);

  const handleApproveClick = (orderId: string) => {
    const order = pendingOrders.find((o) => o.id === orderId);
    if (!order) return;
    setDialogType('approve');
    setDialogOrderId(orderId);
    setDialogOrderNumber(order.orderNumber);
    setDialogAmount(order.totalAmount);
    setDialogOpen(true);
  };

  const handleRejectClick = (orderId: string) => {
    const order = pendingOrders.find((o) => o.id === orderId);
    if (!order) return;
    setDialogType('reject');
    setDialogOrderId(orderId);
    setDialogOrderNumber(order.orderNumber);
    setDialogAmount(order.totalAmount);
    setDialogOpen(true);
  };

  const handleDialogConfirm = async () => {
    setDialogLoading(true);
    try {
      if (dialogType === 'approve') {
        await adminApprovePayment(dialogOrderId);
        toast.success(t('paymentApproved'));
      } else {
        await adminRejectPayment(dialogOrderId);
        toast.success(t('paymentRejected'));
      }
      setDialogOpen(false);
      fetchPending();
      if (activeTab === 'all') fetchAll();
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">{t('pending')}</TabsTrigger>
          <TabsTrigger value="all">{t('all')}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <PendingPaymentsTable
            orders={pendingOrders}
            onApprove={handleApproveClick}
            onReject={handleRejectClick}
            loading={pendingLoading}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {allLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : allPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('noPayments')}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('order')}</TableHead>
                    <TableHead>{t('amount')}</TableHead>
                    <TableHead>{t('method')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('paidAt')}</TableHead>
                    <TableHead>{t('refund')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        #{payment.order.orderNumber}
                      </TableCell>
                      <TableCell>{formatBRL(payment.amount)}</TableCell>
                      <TableCell className="uppercase text-sm">
                        {payment.method}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(payment.providerStatus)}>
                          {getStatusLabel(payment.providerStatus, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.paidAt ? formatDate(payment.paidAt) : '-'}
                      </TableCell>
                      <TableCell>
                        {payment.refundedAmount
                          ? formatBRL(payment.refundedAmount)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {allPagination && allPagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={allPage <= 1}
                    onClick={() => setAllPage(allPage - 1)}
                  >
                    {t('previousPage')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {allPage} / {allPagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={allPage >= allPagination.totalPages}
                    onClick={() => setAllPage(allPage + 1)}
                  >
                    {t('nextPage')}
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <PaymentApprovalDialog
        type={dialogType}
        orderNumber={dialogOrderNumber}
        amount={dialogAmount}
        open={dialogOpen}
        onConfirm={handleDialogConfirm}
        onCancel={() => setDialogOpen(false)}
        loading={dialogLoading}
      />
    </div>
  );
}
