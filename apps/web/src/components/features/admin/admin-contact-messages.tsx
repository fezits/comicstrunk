'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Mail,
  MailOpen,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  listMessages,
  markAsRead,
  markAsResolved,
  deleteMessage,
  type ContactMessage,
  type PaginationMeta,
} from '@/lib/api/admin-contact';

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

const CATEGORY_LABELS: Record<string, string> = {
  SUGGESTION: 'Sugestao',
  PROBLEM: 'Problema',
  PARTNERSHIP: 'Parceria',
  OTHER: 'Outro',
};

function CategoryBadge({ category }: { category: string }) {
  const colorMap: Record<string, string> = {
    SUGGESTION: 'bg-blue-600 hover:bg-blue-700',
    PROBLEM: 'bg-red-600 hover:bg-red-700',
    PARTNERSHIP: 'bg-purple-600 hover:bg-purple-700',
    OTHER: 'bg-gray-600 hover:bg-gray-700',
  };
  return (
    <Badge variant="default" className={colorMap[category] ?? ''}>
      {CATEGORY_LABELS[category] ?? category}
    </Badge>
  );
}

export function AdminContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [resolvedFilter, setResolvedFilter] = useState('all');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        limit: number;
        isRead?: boolean;
        isResolved?: boolean;
        category?: string;
      } = {
        page,
        limit: 20,
      };
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (readFilter === 'read') params.isRead = true;
      if (readFilter === 'unread') params.isRead = false;
      if (resolvedFilter === 'resolved') params.isResolved = true;
      if (resolvedFilter === 'unresolved') params.isResolved = false;

      const result = await listMessages(params);
      setMessages(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter, readFilter, resolvedFilter]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleFilterChange = (
    setter: (value: string) => void,
    value: string,
  ) => {
    setter(value);
    setPage(1);
  };

  const handleMarkAsRead = async (msg: ContactMessage) => {
    try {
      await markAsRead(msg.id);
      toast.success('Mensagem marcada como lida');
      fetchMessages();
    } catch {
      toast.error('Erro ao marcar como lida');
    }
  };

  const handleMarkAsResolved = async (msg: ContactMessage) => {
    try {
      await markAsResolved(msg.id);
      toast.success('Mensagem marcada como resolvida');
      fetchMessages();
    } catch {
      toast.error('Erro ao marcar como resolvida');
    }
  };

  const openDeleteDialog = (msg: ContactMessage) => {
    setDeleteTarget(msg);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMessage(deleteTarget.id);
      toast.success('Mensagem excluida');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      fetchMessages();
    } catch {
      toast.error('Erro ao excluir mensagem');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Categoria:</span>
          <Select
            value={categoryFilter}
            onValueChange={(v) => handleFilterChange(setCategoryFilter, v)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="SUGGESTION">Sugestao</SelectItem>
              <SelectItem value="PROBLEM">Problema</SelectItem>
              <SelectItem value="PARTNERSHIP">Parceria</SelectItem>
              <SelectItem value="OTHER">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Leitura:</span>
          <Select
            value={readFilter}
            onValueChange={(v) => handleFilterChange(setReadFilter, v)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unread">Nao lidas</SelectItem>
              <SelectItem value="read">Lidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Resolucao:</span>
          <Select
            value={resolvedFilter}
            onValueChange={(v) => handleFilterChange(setResolvedFilter, v)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="unresolved">Pendentes</SelectItem>
              <SelectItem value="resolved">Resolvidas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">
            {pagination.total} mensagem(ns)
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
      ) : messages.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhuma mensagem encontrada.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">Lida</TableHead>
                  <TableHead className="text-center">Resolvida</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg) => (
                  <>
                    <TableRow
                      key={msg.id}
                      className={`cursor-pointer ${!msg.isRead ? 'font-semibold bg-accent/30' : ''}`}
                      onClick={() => toggleExpand(msg.id)}
                    >
                      <TableCell className="w-8">
                        {expandedId === msg.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!msg.isRead && (
                            <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                          )}
                          {msg.isRead && (
                            <MailOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate max-w-[120px]">{msg.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                        {msg.email}
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={msg.category} />
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[180px]">
                        {msg.subject}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(msg.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        {msg.isRead ? (
                          <Check className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {msg.isResolved ? (
                          <CheckCheck className="h-4 w-4 text-green-500 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!msg.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleMarkAsRead(msg)}
                              title="Marcar como lida"
                            >
                              <MailOpen className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!msg.isResolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleMarkAsResolved(msg)}
                              title="Marcar como resolvida"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={() => openDeleteDialog(msg)}
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === msg.id && (
                      <TableRow key={`${msg.id}-expanded`}>
                        <TableCell colSpan={9} className="bg-muted/30">
                          <div className="p-4">
                            <p className="text-sm font-medium mb-2">Mensagem completa:</p>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mensagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a mensagem de {deleteTarget?.name}? Esta
              acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
