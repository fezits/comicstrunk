'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BankAccountForm } from '@/components/features/banking/bank-account-form';
import { BankAccountList } from '@/components/features/banking/bank-account-list';
import {
  listBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount,
  type BankAccount,
  type CreateBankAccountInput,
} from '@/lib/api/banking';

export default function SellerBankingPage() {
  const t = useTranslations('banking');
  const tCommon = useTranslations('common');

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      const data = await listBankAccounts();
      setAccounts(data);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreate = async (data: CreateBankAccountInput) => {
    try {
      await createBankAccount(data);
      toast.success(t('accountCreated'));
      setIsFormOpen(false);
      fetchAccounts();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleUpdate = async (data: CreateBankAccountInput) => {
    if (!editingAccount) return;
    try {
      await updateBankAccount(editingAccount.id, data);
      toast.success(t('accountUpdated'));
      setIsFormOpen(false);
      setEditingAccount(undefined);
      fetchAccounts();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBankAccount(id);
      toast.success(t('accountDeleted'));
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setDeletingId(null);
    } catch {
      toast.error(tCommon('error'));
      setDeletingId(null);
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimaryBankAccount(id);
      toast.success(t('primarySet'));
      fetchAccounts();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Button
          onClick={() => {
            setEditingAccount(undefined);
            setIsFormOpen(true);
          }}
        >
          {t('addAccount')}
        </Button>
      </div>

      {/* Account List */}
      <BankAccountList
        accounts={accounts}
        onEdit={(account) => {
          setEditingAccount(account);
          setIsFormOpen(true);
        }}
        onDelete={(id) => setDeletingId(id)}
        onSetPrimary={handleSetPrimary}
      />

      {/* Add/Edit Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingAccount(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? t('editAccount') : t('addAccount')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingAccount ? t('editAccount') : t('addAccount')}
            </DialogDescription>
          </DialogHeader>
          <BankAccountForm
            account={editingAccount}
            onSubmit={editingAccount ? handleUpdate : handleCreate}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingAccount(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('delete')}</DialogTitle>
            <DialogDescription>{t('deleteConfirm')}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('deleteWarning')}</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              {t('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
