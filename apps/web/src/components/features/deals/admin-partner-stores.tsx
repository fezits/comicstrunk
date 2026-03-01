'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  listAllStores,
  createStore,
  updateStore,
  deleteStore,
  type PartnerStore,
  type PaginationMeta,
} from '@/lib/api/deals';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface StoreFormData {
  name: string;
  slug: string;
  affiliateTag: string;
  baseUrl: string;
  logoUrl: string;
}

const emptyForm: StoreFormData = {
  name: '',
  slug: '',
  affiliateTag: '',
  baseUrl: '',
  logoUrl: '',
};

export function AdminPartnerStores() {
  const [stores, setStores] = useState<PartnerStore[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<PartnerStore | null>(null);
  const [form, setForm] = useState<StoreFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PartnerStore | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAllStores({ page, limit: 20 });
      setStores(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Erro ao carregar lojas parceiras');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const openCreateDialog = () => {
    setEditingStore(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (store: PartnerStore) => {
    setEditingStore(store);
    setForm({
      name: store.name,
      slug: store.slug,
      affiliateTag: store.affiliateTag,
      baseUrl: store.baseUrl,
      logoUrl: store.logoUrl || '',
    });
    setDialogOpen(true);
  };

  const handleNameChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: editingStore ? prev.slug : slugify(value),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim() || !form.affiliateTag.trim() || !form.baseUrl.trim()) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        affiliateTag: form.affiliateTag.trim(),
        baseUrl: form.baseUrl.trim(),
      };
      if (form.logoUrl.trim()) {
        payload.logoUrl = form.logoUrl.trim();
      }

      if (editingStore) {
        await updateStore(editingStore.id, payload);
        toast.success('Loja atualizada com sucesso');
      } else {
        await createStore(payload as Parameters<typeof createStore>[0]);
        toast.success('Loja criada com sucesso');
      }

      setDialogOpen(false);
      fetchStores();
    } catch {
      toast.error(editingStore ? 'Erro ao atualizar loja' : 'Erro ao criar loja');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (store: PartnerStore) => {
    try {
      await updateStore(store.id, { isActive: !store.isActive });
      toast.success(store.isActive ? 'Loja desativada' : 'Loja ativada');
      fetchStores();
    } catch {
      toast.error('Erro ao alterar status da loja');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStore(deleteTarget.id);
      toast.success('Loja excluida com sucesso');
      setDeleteTarget(null);
      fetchStores();
    } catch {
      toast.error('Erro ao excluir loja');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {pagination && (
            <span className="text-sm text-muted-foreground">
              {pagination.total} loja{pagination.total !== 1 ? 's' : ''} parceira{pagination.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Loja
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhuma loja parceira cadastrada.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Tag de Afiliado</TableHead>
                  <TableHead>URL Base</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {store.slug}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{store.affiliateTag}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {store.baseUrl}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={store.isActive}
                          onCheckedChange={() => handleToggleActive(store)}
                        />
                        <Badge variant={store.isActive ? 'default' : 'secondary'}>
                          {store.isActive ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditDialog(store)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(store)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStore ? 'Editar Loja Parceira' : 'Nova Loja Parceira'}
            </DialogTitle>
            <DialogDescription>
              {editingStore
                ? 'Atualize os dados da loja parceira.'
                : 'Cadastre uma nova loja parceira para ofertas de afiliados.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Nome *</Label>
              <Input
                id="store-name"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Amazon Brasil"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-slug">Slug *</Label>
              <Input
                id="store-slug"
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="Ex: amazon-brasil"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-tag">Tag de Afiliado *</Label>
              <Input
                id="store-tag"
                value={form.affiliateTag}
                onChange={(e) => setForm((prev) => ({ ...prev, affiliateTag: e.target.value }))}
                placeholder="Ex: comicstrunk-20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-url">URL Base *</Label>
              <Input
                id="store-url"
                value={form.baseUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="Ex: https://www.amazon.com.br"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store-logo">URL do Logo</Label>
              <Input
                id="store-logo"
                value={form.logoUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir loja parceira</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a loja &quot;{deleteTarget?.name}&quot;? As ofertas
              vinculadas serao desativadas.
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
