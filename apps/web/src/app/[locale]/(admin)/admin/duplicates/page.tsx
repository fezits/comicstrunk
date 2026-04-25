'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Trash2, Check, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

interface DuplicateEntry {
  id: string;
  title: string;
  publisher: string;
  sourceKey: string;
  coverImageUrl: string | null;
}

interface DuplicatePair {
  gcd: DuplicateEntry;
  rika: DuplicateEntry;
}

const LIMIT = 20;

export default function AdminDuplicatesPage() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const totalPages = Math.ceil(total / LIMIT);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/duplicates?page=${page}&limit=${LIMIT}`);
      setPairs(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      toast.error('Erro ao carregar duplicatas');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const removeEntry = async (id: string, title: string) => {
    if (!confirm(`Remover "${title}" do catálogo?`)) return;
    setRemoving(id);
    try {
      await apiClient.delete(`/admin/duplicates/${id}`);
      toast.success(`"${title}" removido`);
      setPairs((prev) => prev.filter((p) => p.gcd.id !== id && p.rika.id !== id));
      setTotal((t) => t - 1);
    } catch {
      toast.error('Erro ao remover');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Possíveis Duplicatas</h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString('pt-BR')} pares encontrados — GCD (americano) vs Rika/Panini (brasileiro).
          Compare e decida: remover um, ou manter ambos.
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border rounded-md p-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500" />
          <span>GCD (edição americana)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500" />
          <span>Rika/Panini (edição brasileira)</span>
        </div>
      </div>

      {/* Pagination top */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
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

      {/* Pairs */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando...</div>
      ) : pairs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">Nenhuma duplicata encontrada</div>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair, idx) => (
            <div key={`${pair.gcd.id}-${pair.rika.id}-${idx}`} className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                {/* GCD side */}
                <div className="p-3 bg-blue-500/5">
                  <div className="flex gap-3">
                    <div className="w-16 h-24 bg-muted rounded overflow-hidden shrink-0">
                      {pair.gcd.coverImageUrl ? (
                        <img src={pair.gcd.coverImageUrl} alt={pair.gcd.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          Sem capa
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-500">GCD</p>
                      <p className="text-sm font-medium truncate" title={pair.gcd.title}>
                        {pair.gcd.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{pair.gcd.publisher}</p>
                      <p className="text-[10px] text-muted-foreground/70">{pair.gcd.sourceKey}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs h-7"
                      disabled={removing === pair.gcd.id}
                      onClick={() => removeEntry(pair.gcd.id, pair.gcd.title)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remover GCD
                    </Button>
                  </div>
                </div>

                {/* Rika side */}
                <div className="p-3 bg-amber-500/5">
                  <div className="flex gap-3">
                    <div className="w-16 h-24 bg-muted rounded overflow-hidden shrink-0">
                      {pair.rika.coverImageUrl ? (
                        <img src={pair.rika.coverImageUrl} alt={pair.rika.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          Sem capa
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-500">Rika/Panini</p>
                      <p className="text-sm font-medium truncate" title={pair.rika.title}>
                        {pair.rika.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{pair.rika.publisher}</p>
                      <p className="text-[10px] text-muted-foreground/70">{pair.rika.sourceKey}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs h-7"
                      disabled={removing === pair.rika.id}
                      onClick={() => removeEntry(pair.rika.id, pair.rika.title)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remover Rika
                    </Button>
                  </div>
                </div>
              </div>

              {/* Keep both button */}
              <div className="border-t bg-muted/30 px-3 py-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-green-600"
                  onClick={() => {
                    setPairs((prev) => prev.filter((_, i) => i !== idx));
                    setTotal((t) => t - 1);
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Manter ambos (edições diferentes)
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination bottom */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); window.scrollTo(0, 0); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
