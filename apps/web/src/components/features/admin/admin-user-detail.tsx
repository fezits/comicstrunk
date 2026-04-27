'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Package,
  BookOpen,
  Star,
  Scale,
  Crown,
  Shield,
  UserX,
  UserCheck,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getUser,
  updateUserRole,
  suspendUser,
  unsuspendUser,
  type AdminUserDetail as AdminUserDetailType,
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

export function AdminUserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const locale = useLocale();

  const [user, setUser] = useState<AdminUserDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  // Role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [changingRole, setChangingRole] = useState(false);

  // Suspend dialog
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUser(userId);
      setUser(data);
    } catch {
      toast.error('Erro ao carregar usuario');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleChangeRole = async () => {
    if (!user || !newRole || newRole === user.role) return;
    setChangingRole(true);
    try {
      await updateUserRole(user.id, newRole);
      toast.success(`Cargo atualizado para ${newRole}`);
      setRoleDialogOpen(false);
      fetchUser();
    } catch {
      toast.error('Erro ao alterar cargo');
    } finally {
      setChangingRole(false);
    }
  };

  const handleSuspend = async () => {
    if (!user || !suspendReason.trim()) return;
    if (suspendReason.trim().length < 10) {
      toast.error('O motivo precisa ter pelo menos 10 caracteres');
      return;
    }
    setSuspending(true);
    try {
      await suspendUser(user.id, suspendReason);
      toast.success('Usuario suspenso');
      setSuspendDialogOpen(false);
      fetchUser();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Erro ao suspender usuario';
      toast.error(msg);
    } finally {
      setSuspending(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!user) return;
    try {
      await unsuspendUser(user.id);
      toast.success('Suspensao removida');
      fetchUser();
    } catch {
      toast.error('Erro ao remover suspensao');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Usuario nao encontrado.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/${locale}/admin/users`)}
        >
          Voltar
        </Button>
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const stats = [
    {
      label: 'Pedidos',
      value: user.ordersCount,
      icon: Package,
    },
    {
      label: 'Colecao',
      value: user.collectionItemsCount,
      icon: BookOpen,
    },
    {
      label: 'Avaliacoes',
      value: user.reviewsCount,
      icon: Star,
    },
    {
      label: 'Disputas',
      value: user.disputesAsBuyerCount + user.disputesAsSellerCount,
      icon: Scale,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/${locale}/admin/users`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      {/* User profile card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{user.name}</h2>
                <RoleBadge role={user.role} />
              </div>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-sm text-muted-foreground">
                Cadastrado em {formatDate(user.createdAt)}
              </p>
              {user.bio && (
                <p className="text-sm mt-2">{user.bio}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewRole(user.role);
                  setRoleDialogOpen(true);
                }}
              >
                <Shield className="h-4 w-4 mr-1" />
                Alterar cargo
              </Button>
              {user.role !== 'ADMIN' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => {
                    setSuspendReason('');
                    setSuspendDialogOpen(true);
                  }}
                >
                  <UserX className="h-4 w-4 mr-1" />
                  Suspender
                </Button>
              )}
              {user.role === 'USER' && (
                <Button variant="outline" size="sm" onClick={handleUnsuspend}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Remover suspensao
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Subscription info */}
      {user.subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4" />
              Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plano:</span>
                <p className="font-medium">{user.subscription.planType}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-medium">{user.subscription.status}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Inicio do periodo:</span>
                <p className="font-medium">
                  {user.subscription.currentPeriodStart
                    ? formatDate(user.subscription.currentPeriodStart)
                    : '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Fim do periodo:</span>
                <p className="font-medium">
                  {user.subscription.currentPeriodEnd
                    ? formatDate(user.subscription.currentPeriodEnd)
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Cargo</DialogTitle>
            <DialogDescription>
              Alterar o cargo de {user.name} ({user.email})
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
              disabled={changingRole || newRole === user.role}
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
              Suspender {user.name} ({user.email}). O cargo sera revertido para Usuario
              e assinaturas ativas serao canceladas.
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
