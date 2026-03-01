'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  listAllRequests,
  processRequest,
  completeRequest,
  rejectRequest,
  type DataRequest,
  type DataRequestStatus,
  type PaginationMeta,
} from '@/lib/api/admin-lgpd';

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function StatusBadge({ status }: { status: DataRequestStatus }) {
  switch (status) {
    case 'PENDING':
      return (
        <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700">
          Pendente
        </Badge>
      );
    case 'PROCESSING':
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
          Processando
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          Concluida
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="default" className="bg-red-600 hover:bg-red-700">
          Rejeitada
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function TypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    ACCESS: 'Acesso',
    CORRECTION: 'Correcao',
    DELETION: 'Exclusao',
    EXPORT: 'Exportacao',
  };
  return <span>{labels[type] ?? type}</span>;
}

export function AdminLgpdRequests() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<DataRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; limit: number; status?: string } = {
        page,
        limit: 20,
      };
      if (statusFilter !== 'all') params.status = statusFilter;

      const result = await listAllRequests(params);
      setRequests(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Erro ao carregar solicitacoes LGPD');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleProcess = async (request: DataRequest) => {
    try {
      await processRequest(request.id);
      toast.success('Solicitacao marcada como processando');
      fetchRequests();
    } catch {
      toast.error('Erro ao processar solicitacao');
    }
  };

  const handleComplete = async (request: DataRequest) => {
    try {
      await completeRequest(request.id);
      toast.success('Solicitacao concluida');
      fetchRequests();
    } catch {
      toast.error('Erro ao concluir solicitacao');
    }
  };

  const openRejectDialog = (request: DataRequest) => {
    setRejectTarget(request);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await rejectRequest(rejectTarget.id, rejectReason);
      toast.success('Solicitacao rejeitada');
      setRejectDialogOpen(false);
      setRejectTarget(null);
      fetchRequests();
    } catch {
      toast.error('Erro ao rejeitar solicitacao');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="PROCESSING">Processando</SelectItem>
              <SelectItem value="COMPLETED">Concluida</SelectItem>
              <SelectItem value="REJECTED">Rejeitada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">
            {pagination.total} solicitacao(oes)
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
      ) : requests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhuma solicitacao encontrada.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const isDeletion = request.type === 'DELETION';
                  return (
                    <TableRow
                      key={request.id}
                      className={isDeletion ? 'border-l-2 border-l-red-500 bg-red-500/5' : ''}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{request.user.name}</p>
                          <p className="text-xs text-muted-foreground">{request.user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isDeletion && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <TypeLabel type={request.type} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={request.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {request.status === 'PENDING' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleProcess(request)}
                              >
                                Processar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => openRejectDialog(request)}
                              >
                                Rejeitar
                              </Button>
                            </>
                          )}
                          {request.status === 'PROCESSING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleComplete(request)}
                            >
                              Concluir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitacao</DialogTitle>
            <DialogDescription>
              Rejeitar a solicitacao de {rejectTarget?.user.name} (
              {rejectTarget?.type === 'DELETION'
                ? 'Exclusao de conta'
                : rejectTarget?.type === 'ACCESS'
                  ? 'Acesso aos dados'
                  : rejectTarget?.type === 'CORRECTION'
                    ? 'Correcao de dados'
                    : 'Exportacao de dados'}
              )
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Motivo da rejeicao..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !rejectReason.trim()}
            >
              {rejecting ? 'Rejeitando...' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
