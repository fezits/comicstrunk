'use client';

import { useTranslations } from 'next-intl';
import { Building2, Pencil, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BankAccount } from '@/lib/api/banking';

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
}

interface BankAccountListProps {
  accounts: BankAccount[];
  onEdit: (account: BankAccount) => void;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

export function BankAccountList({
  accounts,
  onEdit,
  onDelete,
  onSetPrimary,
}: BankAccountListProps) {
  const t = useTranslations('banking');

  if (accounts.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <Building2 className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <p className="text-lg text-muted-foreground">{t('noAccounts')}</p>
        <p className="text-sm text-muted-foreground">{t('addFirstAccount')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <Card key={account.id}>
          <CardContent className="flex items-start gap-4 p-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{account.bankName}</span>
                {account.isPrimary && (
                  <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/20 text-[10px] px-1.5 py-0">
                    {t('primary')}
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {account.accountType === 'CHECKING' ? t('checking') : t('savings')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('branch')}: {account.branchNumber} | {t('account')}:{' '}
                {maskAccountNumber(account.accountNumber)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('holder')}: {account.holderName}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!account.isPrimary && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onSetPrimary(account.id)}
                  title={t('setPrimary')}
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(account)}
                title={t('edit')}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(account.id)}
                title={t('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
