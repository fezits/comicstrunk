'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ExternalLink, Search, UserX, UserCheck, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  listUsers,
  updateUserRole,
  suspendUser,
  unsuspendUser,
  type AdminUser,
  type PaginationMeta,
} from '@/lib/api/admin';

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'ADMIN':
      return (
        <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">
          Admin
        </Badge>
      );
    case 'SUBSCRIBER':
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
          Assinante
        </Badge>
      );
    default:
      return <Badge variant="secondary">Usuario</Badge>;
  }
}

export function AdminUserManagement() {
  const locale = useLocale();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Suspend dialog state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);

  // Role change dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState('');
  const [changingRole, setChangingRole] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; search?: string; role?: string } = {
        page,
        limit: 20,
      };
      if (search) params.search = search;
      if (roleFilter !== 'all') params.role = roleFilter;

      const result = await listUsers(params);
      setUsers(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  // Role change
  const openRoleDialog = (user: AdminUser) => {
    setRoleTarget(user);
    setNewRole(user.role);
    setRoleDialogOpen(true);
  };

  const handleChangeRole = async () => {
    if (!roleTarget || !newRole || newRole === roleTarget.role) return;
    setChangingRole(true);
    try {
      await updateUserRole(roleTarget.id, newRole);
      toast.success(`Cargo de ${roleTarget.name} atualizado para ${newRole}`);
      setRoleDialogOpen(false);
      setRoleTarget(null);
      fetchUsers();
    } catch {
      toast.error('Erro ao alterar cargo do usuario');
    } finally {
      setChangingRole(false);
    }
  };

  // Suspend
  const openSuspendDialog = (user: AdminUser) => {
    setSuspendTarget(user);
    setSuspendReason('');
    setSuspendDialogOpen(true);
  };

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    setSuspending(true);
    try {
      await suspendUser(suspendTarget.id, suspendReason);
      toast.success(`Usuario ${suspendTarget.name} suspenso`);
      setSuspendDialogOpen(false);
      setSuspendTarget(null);
      fetchUsers();
    } catch {
      toast.error('Erro ao suspender usuario');
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async (user: AdminUser) => {
    try {
      await unsuspendUser(user.id);
      toast.success(`Suspensao de ${user.name} removida`);
      fetchUsers();
    } catch {
      toast.error('Erro ao remover suspensao');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          Buscar
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Cargo:</span>
          <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="USER">Usuario</SelectItem>
              <SelectItem value="SUBSCRIBER">Assinante</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">
            {pagination.total} usuario{pagination.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum usuario encontrado.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <RoleBadge role={user.role} />
                        {user.suspended && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Suspenso
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                          <Link href={`/${locale}/admin/users/${user.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openRoleDialog(user)}
                          title={user.suspended ? 'Remova a suspensao para alterar o cargo' : 'Alterar cargo'}
                          disabled={user.suspended}
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                        {user.role !== 'ADMIN' && !user.suspended && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={() => openSuspendDialog(user)}
                            title="Suspender"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {user.suspended && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-green-500 hover:text-green-600"
                            onClick={() => handleUnsuspend(user)}
                            title="Remover suspensao"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Cargo</DialogTitle>
            <DialogDescription>
              Alterar o cargo de {roleTarget?.name} ({roleTarget?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">Usuario</SelectItem>
                <SelectItem value="SUBSCRIBER">Assinante</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={changingRole || newRole === roleTarget?.role}
            >
              {changingRole ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Usuario</DialogTitle>
            <DialogDescription>
              Suspender {suspendTarget?.name} ({suspendTarget?.email}). O cargo sera
              revertido para Usuario e assinaturas ativas serao canceladas.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo da suspensao..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={suspending || !suspendReason.trim()}
            >
              {suspending ? 'Suspendendo...' : 'Suspender'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
