'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminBankAccount, PaginationMeta } from '@/lib/api/admin-payments';
import { getAdminBankAccounts } from '@/lib/api/admin-payments';

function maskAccount(account: string): string {
  if (account.length <= 4) return account;
  return '*'.repeat(account.length - 4) + account.slice(-4);
}

function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length < 11) return cpf;
  return digits.slice(0, 3) + '.***.***-' + digits.slice(-2);
}

export function AdminBankingPage() {
  const t = useTranslations('adminBanking');
  const tCommon = useTranslations('common');

  const [accounts, setAccounts] = useState<AdminBankAccount[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminBankAccounts({ page, limit: 20 });
      setAccounts(res.data);
      setPagination(res.pagination);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [page, tCommon]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const filteredAccounts = search.trim()
    ? accounts.filter(
        (a) =>
          a.user.name.toLowerCase().includes(search.toLowerCase()) ||
          a.user.email.toLowerCase().includes(search.toLowerCase()),
      )
    : accounts;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">{t('noAccounts')}</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('seller')}</TableHead>
                <TableHead>{t('bank')}</TableHead>
                <TableHead>{t('branch')}</TableHead>
                <TableHead>{t('account')}</TableHead>
                <TableHead>{t('cpf')}</TableHead>
                <TableHead>{t('holder')}</TableHead>
                <TableHead>{t('type')}</TableHead>
                <TableHead>{t('primary')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{account.user.name}</p>
                      <p className="text-xs text-muted-foreground">{account.user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{account.bankName}</TableCell>
                  <TableCell>{account.branchNumber}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {maskAccount(account.accountNumber)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {maskCpf(account.cpf)}
                  </TableCell>
                  <TableCell>{account.holderName}</TableCell>
                  <TableCell>
                    {account.accountType === 'CHECKING' ? t('checking') : t('savings')}
                  </TableCell>
                  <TableCell>
                    {account.isPrimary && (
                      <Badge variant="default">{t('primary')}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
    </div>
  );
}
