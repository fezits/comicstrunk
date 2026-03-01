'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminDealForm } from './admin-deal-form';
import {
  listAllDeals,
  listStores,
  updateDeal,
  deleteDeal,
  type Deal,
  type DealType,
  type PartnerStore,
  type PaginationMeta,
} from '@/lib/api/deals';

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

type DealStatus = 'active' | 'expired' | 'inactive';

function getDealStatus(deal: Deal): DealStatus {
  if (!deal.isActive) return 'inactive';
  if (deal.expiresAt && new Date(deal.expiresAt) < new Date()) return 'expired';
  return 'active';
}

function getStatusBadge(status: DealStatus) {
  switch (status) {
    case 'active':
      return <Badge variant="default">Ativa</Badge>;
    case 'expired':
      return <Badge variant="secondary">Expirada</Badge>;
    case 'inactive':
      return <Badge variant="outline">Inativa</Badge>;
  }
}

function getTypeBadge(type: DealType) {
  if (type === 'COUPON') {
    return <Badge variant="secondary">Cupom</Badge>;
  }
  return <Badge variant="default">Promocao</Badge>;
}

export function AdminDealsList() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [stores, setStores] = useState<PartnerStore[]>([]);
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAllDeals({ page, limit: 20 });
      setDeals(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Erro ao carregar ofertas');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  useEffect(() => {
    listStores().then(setStores).catch(() => {});
  }, []);

  const openCreateForm = () => {
    setEditingDeal(null);
    setFormOpen(true);
  };

  const openEditForm = (deal: Deal) => {
    setEditingDeal(deal);
    setFormOpen(true);
  };

  const handleToggleActive = async (deal: Deal) => {
    try {
      await updateDeal(deal.id, { isActive: !deal.isActive });
      toast.success(deal.isActive ? 'Oferta desativada' : 'Oferta ativada');
      fetchDeals();
    } catch {
      toast.error('Erro ao alterar status da oferta');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDeal(deleteTarget.id);
      toast.success('Oferta excluida com sucesso');
      setDeleteTarget(null);
      fetchDeals();
    } catch {
      toast.error('Erro ao excluir oferta');
    } finally {
      setDeleting(false);
    }
  };

  // Client-side filtering
  const filteredDeals = deals.filter((deal) => {
    if (storeFilter !== 'all' && deal.storeId !== storeFilter) return false;
    if (typeFilter !== 'all' && deal.type !== typeFilter) return false;
    if (statusFilter !== 'all') {
      const status = getDealStatus(deal);
      if (statusFilter === 'active' && status !== 'active') return false;
      if (statusFilter === 'expired' && status !== 'expired') return false;
      if (statusFilter === 'inactive' && status !== 'inactive') return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters and Action */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Loja:</span>
          <Select value={storeFilter} onValueChange={(v) => { setStoreFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Tipo:</span>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="COUPON">Cupom</SelectItem>
              <SelectItem value="PROMOTION">Promocao</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button onClick={openCreateForm} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Oferta
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhuma oferta encontrada.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal) => {
                  const status = getDealStatus(deal);
                  return (
                    <TableRow key={deal.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {deal.title}
                      </TableCell>
                      <TableCell className="text-sm">{deal.store.name}</TableCell>
                      <TableCell>{getTypeBadge(deal.type)}</TableCell>
                      <TableCell className="text-sm">{deal.discount || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={deal.isActive}
                            onCheckedChange={() => handleToggleActive(deal)}
                          />
                          {getStatusBadge(status)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(deal.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditForm(deal)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(deal)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
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
                Proxima
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Form Dialog */}
      <AdminDealForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editingDeal={editingDeal}
        onSaved={fetchDeals}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir oferta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a oferta &quot;{deleteTarget?.title}&quot;? A oferta
              sera desativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
