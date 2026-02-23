'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Upload, Download } from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ApprovalBadge } from '@/components/features/catalog/approval-badge';
import type { CatalogEntry, PaginationMeta } from '@/lib/api/catalog';
import {
  getAdminCatalogList,
  approveCatalogEntry,
  rejectCatalogEntry,
  submitForReview,
  deleteCatalogEntry,
  exportCSV,
} from '@/lib/api/admin-catalog';

type StatusFilter = 'PENDING' | 'DRAFT' | 'APPROVED' | 'REJECTED' | undefined;

export default function AdminCatalogPage() {
  const t = useTranslations('admin.catalog');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [page, setPage] = useState(1);

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminCatalogList({
        page,
        limit: 20,
        approvalStatus: statusFilter,
      });
      setEntries(res.data);
      setPagination(res.pagination);
    } catch {
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, tCommon]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleTabChange = (value: string) => {
    setStatusFilter(value === 'ALL' ? undefined : (value as StatusFilter));
    setPage(1);
  };

  const handleApprove = async (id: string) => {
    try {
      await approveCatalogEntry(id);
      toast.success(t('approveSuccess'));
      fetchEntries();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleSubmitReview = async (id: string) => {
    try {
      await submitForReview(id);
      toast.success(t('submitSuccess'));
      fetchEntries();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    try {
      await rejectCatalogEntry(rejectId, rejectReason);
      toast.success(t('rejectSuccess'));
      setRejectId(null);
      setRejectReason('');
      fetchEntries();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCatalogEntry(deleteId);
      toast.success(t('deleteSuccess'));
      setDeleteId(null);
      fetchEntries();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  const handleExport = async () => {
    try {
      await exportCSV();
      toast.success(t('exportSuccess'));
    } catch {
      toast.error(tCommon('error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/${locale}/admin/catalog/new`}>
              <Plus className="h-4 w-4 mr-2" />
              {t('new')}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/admin/catalog/import`}>
              <Upload className="h-4 w-4 mr-2" />
              {t('import')}
            </Link>
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('export')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="PENDING" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="PENDING">{t('pending')}</TabsTrigger>
          <TabsTrigger value="DRAFT">{t('drafts')}</TabsTrigger>
          <TabsTrigger value="APPROVED">{t('approved')}</TabsTrigger>
          <TabsTrigger value="REJECTED">{t('rejected')}</TabsTrigger>
          <TabsTrigger value="ALL">{t('all')}</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter ?? 'ALL'} className="mt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t('noEntries')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>{t('form.title')}</TableHead>
                  <TableHead>{t('form.author')}</TableHead>
                  <TableHead>{t('form.publisher')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="w-10 h-14 bg-muted rounded overflow-hidden">
                        {entry.coverImageUrl && (
                          <img
                            src={entry.coverImageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {entry.title}
                    </TableCell>
                    <TableCell>{entry.author ?? '—'}</TableCell>
                    <TableCell>{entry.publisher ?? '—'}</TableCell>
                    <TableCell>
                      <ApprovalBadge status={entry.approvalStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {entry.approvalStatus === 'DRAFT' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSubmitReview(entry.id)}
                            >
                              {t('submitReview')}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteId(entry.id)}
                            >
                              {tCommon('delete')}
                            </Button>
                          </>
                        )}
                        {entry.approvalStatus === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(entry.id)}
                            >
                              {t('approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRejectId(entry.id);
                                setRejectReason('');
                              }}
                            >
                              {t('reject')}
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/${locale}/admin/catalog/${entry.id}/edit`}>
                            {tCommon('edit')}
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

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
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reject')}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={t('rejectReason')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              {t('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmDelete')}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
