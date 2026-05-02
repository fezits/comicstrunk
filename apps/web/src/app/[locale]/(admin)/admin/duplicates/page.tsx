'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Trash2, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

const LIMIT = 50;

export default function AdminDuplicatesPage() {
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'pattern' | 'title'>('pattern');
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  const totalPages = Math.ceil(total / LIMIT);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await apiClient.get(`/admin/duplicates?page=${page}&limit=${LIMIT}&mode=${mode}`);
      setPairs(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      toast.error('Erro ao carregar duplicatas');
    } finally {
      setLoading(false);
    }
  }, [page, mode]); // eslint-disable-line

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllGcd = () => {
    setSelected(new Set(pairs.map((p) => p.gcd.id)));
  };

  const selectAllRika = () => {
    setSelected(new Set(pairs.map((p) => p.rika.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Remover ${selected.size} entradas do catálogo?`)) return;

    setBulkRemoving(true);
    let removed = 0;
    let errors = 0;

    for (const id of selected) {
      try {
        await apiClient.delete(`/admin/duplicates/${id}`);
        removed++;
      } catch {
        errors++;
      }
    }

    if (removed > 0) toast.success(`${removed} entradas removidas`);
    if (errors > 0) toast.error(`${errors} erros ao remover`);

    setBulkRemoving(false);
    setSelected(new Set());
    fetchDuplicates();
  };

  const removeEntry = async (id: string, title: string) => {
    setRemovingId(id);
    try {
      await apiClient.delete(`/admin/duplicates/${id}`);
      toast.success(`"${title}" removido`);
      setPairs((prev) => prev.filter((p) => p.gcd.id !== id && p.rika.id !== id));
      setTotal((t) => t - 1);
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Erro ao remover';
      toast.error(msg);
      // Refresh pra confirmar o estado real
      fetchDuplicates();
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Possíveis Duplicatas</h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString('pt-BR')} pares encontrados.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-2 border rounded-md p-2 bg-muted/30">
        <span className="text-xs text-muted-foreground">Modo:</span>
        <Button
          variant={mode === 'pattern' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-7"
          onClick={() => { setMode('pattern'); setPage(1); }}
        >
          Padrão GCD #issue
        </Button>
        <Button
          variant={mode === 'title' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-7"
          onClick={() => { setMode('title'); setPage(1); }}
        >
          Mesmo título (qualquer fonte)
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border rounded-md p-3 bg-muted/30">
        <span className="text-xs text-muted-foreground mr-2">Selecionar:</span>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAllGcd}>
          Todos GCD
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={selectAllRika}>
          Todos Rika
        </Button>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearSelection} disabled={selected.size === 0}>
          Limpar
        </Button>
        <div className="flex-1" />
        {selected.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1"
            onClick={bulkDelete}
            disabled={bulkRemoving}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkRemoving ? 'Removendo...' : `Remover ${selected.size} selecionados`}
          </Button>
        )}
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
        <div className="space-y-3">
          {pairs.map((pair, idx) => (
            <div key={`${pair.gcd.id}-${pair.rika.id}-${idx}`} className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-2 divide-x">
                {/* GCD side */}
                <div className="p-3 bg-blue-500/5">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Checkbox
                        checked={selected.has(pair.gcd.id)}
                        onCheckedChange={() => toggleSelect(pair.gcd.id)}
                      />
                      <button
                        className="w-16 h-24 bg-muted rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => pair.gcd.coverImageUrl && setZoomedImage({ url: pair.gcd.coverImageUrl, title: pair.gcd.title })}
                      >
                        {pair.gcd.coverImageUrl ? (
                          <img src={pair.gcd.coverImageUrl} alt={pair.gcd.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">Sem capa</div>
                        )}
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-500">GCD</p>
                      <p className="text-sm font-medium line-clamp-2" title={pair.gcd.title}>{pair.gcd.title}</p>
                      <p className="text-xs text-muted-foreground">{pair.gcd.publisher}</p>
                      <p className="text-[10px] text-muted-foreground/70">{pair.gcd.sourceKey}</p>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-xs h-6 mt-1 px-2"
                        disabled={removingId === pair.gcd.id}
                        onClick={() => removeEntry(pair.gcd.id, pair.gcd.title)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Rika side */}
                <div className="p-3 bg-amber-500/5">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Checkbox
                        checked={selected.has(pair.rika.id)}
                        onCheckedChange={() => toggleSelect(pair.rika.id)}
                      />
                      <button
                        className="w-16 h-24 bg-muted rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => pair.rika.coverImageUrl && setZoomedImage({ url: pair.rika.coverImageUrl, title: pair.rika.title })}
                      >
                        {pair.rika.coverImageUrl ? (
                          <img src={pair.rika.coverImageUrl} alt={pair.rika.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">Sem capa</div>
                        )}
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-500">Rika/Panini</p>
                      <p className="text-sm font-medium line-clamp-2" title={pair.rika.title}>{pair.rika.title}</p>
                      <p className="text-xs text-muted-foreground">{pair.rika.publisher}</p>
                      <p className="text-[10px] text-muted-foreground/70">{pair.rika.sourceKey}</p>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-xs h-6 mt-1 px-2"
                        disabled={removingId === pair.rika.id}
                        onClick={() => removeEntry(pair.rika.id, pair.rika.title)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Keep both button */}
              <div className="border-t bg-muted/30 px-3 py-1.5 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-green-600"
                  onClick={async () => {
                    try {
                      await apiClient.post('/admin/duplicates/dismiss', {
                        sourceKeyA: pair.gcd.sourceKey,
                        sourceKeyB: pair.rika.sourceKey,
                      });
                      setPairs((prev) => prev.filter((_, i) => i !== idx));
                      setTotal((t) => t - 1);
                    } catch {
                      toast.error('Erro ao salvar');
                    }
                  }}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Manter ambos
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

      {/* Image zoom modal — click to open, click outside to close */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center text-white hover:bg-black/80 z-10"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={zoomedImage.url} alt={zoomedImage.title} className="max-h-[80vh] max-w-[90vw] object-contain rounded shadow-2xl" />
            <p className="text-white text-center mt-2 text-sm">{zoomedImage.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}
