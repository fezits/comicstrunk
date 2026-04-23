'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2, CheckSquare, Square, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';

interface CoverEntry {
  id: string;
  title: string;
  slug: string | null;
  coverImageUrl: string | null;
  coverFileName: string | null;
  publisher: string | null;
}

const LIMIT = 120;

export default function AdminCoverReviewPage() {
  const tCommon = useTranslations('common');
  const [entries, setEntries] = useState<CoverEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [filter, setFilter] = useState('rika');
  const [sort, setSort] = useState('title');

  const totalPages = Math.ceil(total / LIMIT);

  const fetchCovers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/covers/review?page=${page}&limit=${LIMIT}&filter=${filter}&sort=${sort}`);
      setEntries(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      toast.error('Erro ao carregar capas');
    } finally {
      setLoading(false);
    }
  }, [page, filter, sort]);

  useEffect(() => {
    fetchCovers();
    setSelected(new Set());
  }, [fetchCovers]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map(e => e.id)));
    }
  };

  const removeSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remover capa de ${selected.size} gibi(s)? A imagem será substituída pelo ícone padrão.`)) return;

    setRemoving(true);
    try {
      const res = await apiClient.post('/admin/covers/remove', { ids: Array.from(selected) });
      toast.success(`${res.data.data.removed} capa(s) removida(s)`);
      setSelected(new Set());
      fetchCovers();
    } catch {
      toast.error('Erro ao remover capas');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revisar Capas</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString('pt-BR')} capas encontradas — selecione placeholders para remover
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['placeholder_rika', 'rika', 'panini', 'openlibrary', 'all'].map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {f === 'all' ? 'Todas' : f === 'placeholder_rika' ? 'Placeholders Rika' : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Ordenar:</span>
        {[{ key: 'title', label: 'Título' }, { key: 'filename', label: 'Arquivo' }].map(s => (
          <Button
            key={s.key}
            variant={sort === s.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSort(s.key); setPage(1); }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 sticky top-16 z-30 bg-background py-2 border-b">
        <Button variant="outline" size="sm" onClick={selectAll} className="gap-2">
          {selected.size === entries.length && entries.length > 0 ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {selected.size === entries.length && entries.length > 0 ? 'Desmarcar todas' : 'Selecionar todas'}
        </Button>

        {selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={removeSelected}
            disabled={removing}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Remover {selected.size} capa(s)
          </Button>
        )}

        <span className="text-sm text-muted-foreground ml-auto">
          Página {page} de {totalPages}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {Array.from({ length: LIMIT }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhuma capa encontrada</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {entries.map(entry => {
            const isSelected = selected.has(entry.id);
            return (
              <div
                key={entry.id}
                className={`relative cursor-pointer rounded border-2 transition-all overflow-hidden ${
                  isSelected
                    ? 'border-red-500 ring-2 ring-red-500/30 opacity-60'
                    : 'border-transparent hover:border-primary/50'
                }`}
                onClick={() => toggleSelect(entry.id)}
              >
                <div className="aspect-[2/3] bg-muted">
                  {entry.coverImageUrl ? (
                    <img
                      src={entry.coverImageUrl}
                      alt={entry.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="p-1">
                  <p className="text-[10px] leading-tight truncate" title={entry.title}>
                    {entry.title}
                  </p>
                </div>
                {/* Selection checkbox indicator */}
                <div className={`absolute top-1 left-1 w-5 h-5 rounded flex items-center justify-center text-white text-xs ${
                  isSelected ? 'bg-red-500' : 'bg-black/30'
                }`}>
                  {isSelected ? '✕' : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
