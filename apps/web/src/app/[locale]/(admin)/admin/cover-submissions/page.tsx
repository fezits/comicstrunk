'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, X, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api/client';

interface Submission {
  id: string;
  catalogEntryId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  imageUrl: string;
  submittedAt: string;
  entry: {
    title: string;
    publisher: string | null;
    coverImageUrl: string | null;
    coverFileName: string | null;
    sourceKey: string | null;
  };
}

const LIMIT = 20;

export default function AdminCoverSubmissionsPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const totalPages = Math.ceil(total / LIMIT);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/cover-submissions?page=${page}&limit=${LIMIT}`);
      setItems(res.data.data?.items || []);
      setTotal(res.data.data?.total || 0);
    } catch {
      toast.error('Erro ao carregar submissões');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await apiClient.post(`/admin/cover-submissions/${id}/approve`);
      toast.success('Capa aprovada');
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch {
      toast.error('Erro ao aprovar');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Motivo da rejeição (opcional):');
    if (reason === null) return;
    setActingId(id);
    try {
      await apiClient.post(`/admin/cover-submissions/${id}/reject`, { reason: reason || undefined });
      toast.success('Capa rejeitada');
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => t - 1);
    } catch {
      toast.error('Erro ao rejeitar');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Capas para revisar</h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString('pt-BR')} submissões pendentes
        </p>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-2">
          <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          <p>Nenhuma submissão pendente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((s) => (
            <div key={s.id} className="border rounded-lg p-3 bg-card">
              <div className="grid grid-cols-2 gap-3">
                {/* Current */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Atual</p>
                  <div className="aspect-[2/3] bg-muted rounded overflow-hidden">
                    <img
                      src={s.entry.coverFileName ? `https://covers.comicstrunk.com/covers/${s.entry.coverFileName}` : (s.entry.coverImageUrl || 'https://covers.comicstrunk.com/cover-placeholder.jpg')}
                      alt={s.entry.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://covers.comicstrunk.com/cover-placeholder.jpg'; }}
                    />
                  </div>
                </div>
                {/* Submitted */}
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">Enviada</p>
                  <div className="aspect-[2/3] bg-muted rounded overflow-hidden">
                    <img
                      src={s.imageUrl}
                      alt="Submissão"
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => window.open(s.imageUrl, '_blank')}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <p className="font-medium text-sm line-clamp-2">{s.entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.entry.publisher || 'Sem editora'} · {s.entry.sourceKey || ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Por: {s.userName || s.userEmail} · {new Date(s.submittedAt).toLocaleString('pt-BR')}
                </p>
              </div>

              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 gap-1"
                  disabled={actingId === s.id}
                  onClick={() => handleApprove(s.id)}
                >
                  <Check className="h-4 w-4" />
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 gap-1"
                  disabled={actingId === s.id}
                  onClick={() => handleReject(s.id)}
                >
                  <X className="h-4 w-4" />
                  Rejeitar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
