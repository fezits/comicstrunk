'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommissionSummaryCards } from './commission-summary-cards';
import { CommissionTransactionsTable } from './commission-transactions-table';
import type { CommissionDashboardData, CommissionTransaction } from '@/lib/api/admin-commission';
import type { PaginationMeta } from '@/lib/api/admin-payments';
import { getCommissionDashboard, getCommissionTransactions } from '@/lib/api/admin-commission';

function getDefaultPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

function getDefaultPeriodEnd(): string {
  return new Date().toISOString().split('T')[0];
}

export function AdminCommissionPage() {
  const t = useTranslations('adminCommission');
  const tCommon = useTranslations('common');

  const [periodStart, setPeriodStart] = useState(getDefaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(getDefaultPeriodEnd);

  const [dashboardData, setDashboardData] = useState<CommissionDashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [transactions, setTransactions] = useState<CommissionTransaction[]>([]);
  const [txPagination, setTxPagination] = useState<PaginationMeta | null>(null);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(true);

  // Use refs to access latest period values without adding them as effect dependencies
  const periodRef = useRef({ start: periodStart, end: periodEnd });
  periodRef.current = { start: periodStart, end: periodEnd };

  const fetchData = useCallback(
    async (page: number) => {
      const { start, end } = periodRef.current;
      setDashboardLoading(true);
      setTxLoading(true);

      try {
        const [dashboard, txResult] = await Promise.all([
          getCommissionDashboard(start, end),
          getCommissionTransactions({
            periodStart: start,
            periodEnd: end,
            page,
            limit: 20,
          }),
        ]);

        setDashboardData(dashboard);
        setTransactions(txResult.data);
        setTxPagination(txResult.pagination);
      } catch {
        toast.error(tCommon('error'));
      } finally {
        setDashboardLoading(false);
        setTxLoading(false);
      }
    },
    [tCommon],
  );

  // Initial load and page changes
  useEffect(() => {
    fetchData(txPage);
  }, [txPage, fetchData]);

  const handleFilter = () => {
    setTxPage(1);
    fetchData(1);
  };

  const handlePageChange = (page: number) => {
    setTxPage(page);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      {/* Period filter */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="periodStart">{t('periodStart')}</Label>
          <Input
            id="periodStart"
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="periodEnd">{t('periodEnd')}</Label>
          <Input
            id="periodEnd"
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={handleFilter}>{t('filter')}</Button>
      </div>

      {/* Summary cards */}
      <CommissionSummaryCards data={dashboardData} loading={dashboardLoading} />

      {/* Transactions table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('transactions')}</h2>
        <CommissionTransactionsTable
          transactions={transactions}
          pagination={txPagination}
          onPageChange={handlePageChange}
          loading={txLoading}
          currentPage={txPage}
        />
      </div>
    </div>
  );
}
