'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, Search, ImageIcon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  listMissingCovers,
  listMissingCoverPublishers,
  searchCoversForEntry,
  applyCoverToEntry,
} from '@/lib/api/admin-cover-management';
import type {
  AdminMissingCoverEntry,
  AdminCoverCandidate,
  AdminCoverSource,
} from '@comicstrunk/contracts';

const LIMIT = 30;

const SOURCE_LABEL: Record<AdminCoverSource, string> = {
  amazon: 'Amazon BR',
  rika: 'Rika',
  excelsior: 'Excelsior Comics',
};

interface SearchState {
  loading: boolean;
  source: AdminCoverSource | null;
  triedSources: AdminCoverSource[];
  candidates: AdminCoverCandidate[];
}

export default function AdminCoverManagementPage() {
  const [items, setItems] = useState<AdminMissingCoverEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [publisher, setPublisher] = useState<string>('');
  const [publishers, setPublishers] = useState<Array<{ publisher: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  // Modal de busca/seleção de capa pra um entry específico
  const [activeEntry, setActiveEntry] = useState<AdminMissingCoverEntry | null>(null);
  const [searchState, setSearchState] = useState<SearchState>({
    loading: false,
    source: null,
    triedSources: [],
    candidates: [],
  });
  const [applyingUrl, setApplyingUrl] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMissingCovers({
        page,
        limit: LIMIT,
        publisher: publisher || undefined,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      toast.error('Erro ao carregar lista de capas faltantes');
    } finally {
      setLoading(false);
    }
  }, [page, publisher]);

  useEffect(() => {
    listMissingCoverPublishers()
      .then(setPublishers)
      .catch(() => toast.error('Erro ao carregar publishers'));
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openSearch = async (entry: AdminMissingCoverEntry) => {
    setActiveEntry(entry);
    setSearchState({ loading: true, source: null, triedSources: [], candidates: [] });
    try {
      const result = await searchCoversForEntry(entry.id);
      setSearchState({
        loading: false,
        source: result.source,
        triedSources: result.triedSources,
        candidates: result.candidates,
      });
    } catch {
      setSearchState({ loading: false, source: null, triedSources: [], candidates: [] });
      toast.error('Erro ao buscar candidatos');
    }
  };

  const closeSearch = () => {
    if (applyingUrl) return;
    setActiveEntry(null);
    setSearchState({ loading: false, source: null, triedSources: [], candidates: [] });
  };

  const handleApply = async (candidate: AdminCoverCandidate) => {
    if (!activeEntry) return;
    setApplyingUrl(candidate.imageUrl);
    try {
      await applyCoverToEntry(activeEntry.id, {
        imageUrl: candidate.imageUrl,
        source: candidate.source,
        externalRef: candidate.externalRef,
      });
      toast.success('Capa aplicada com sucesso');
      // Remove o item da lista (já tem capa agora)
      setItems((prev) => prev.filter((x) => x.id !== activeEntry.id));
      setTotal((t) => t - 1);
      setActiveEntry(null);
      setSearchState({ loading: false, source: null, triedSources: [], candidates: [] });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = e.response?.data?.error?.message ?? 'Erro ao aplicar capa';
      toast.error(msg);
    } finally {
      setApplyingUrl(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de capas faltantes</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo com {total.toLocaleString('pt-BR')}{' '}
          {publisher ? `entradas de ${publisher} ` : 'entradas '}
          sem capa. Clique em &quot;Buscar capas&quot; para tentar Amazon BR → Rika → Excelsior Comics.
        </p>
      </div>

      {/* Filtro publisher */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Publisher:</label>
        <select
          value={publisher}
          onChange={(e) => {
            setPublisher(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          {publishers.map((p) => (
            <option key={p.publisher} value={p.publisher}>
              {p.publisher} ({p.count})
            </option>
          ))}
        </select>
        {publisher && (
          <Button variant="ghost" size="sm" onClick={() => setPublisher('')}>
            Limpar
          </Button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma entrada sem capa neste filtro.
        </p>
      ) : (
        <div className="rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Título</th>
                <th className="px-3 py-2 text-left font-medium">Publisher</th>
                <th className="px-3 py-2 text-left font-medium">Edição</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{entry.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.publisher ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.editionNumber !== null ? `#${entry.editionNumber}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {entry.approvalStatus}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openSearch(entry)}>
                      <Search className="mr-1.5 h-3.5 w-3.5" />
                      Buscar capas
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de candidatos */}
      <Dialog
        open={!!activeEntry}
        onOpenChange={(open) => {
          if (!open) closeSearch();
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{activeEntry?.title}</DialogTitle>
            <DialogDescription>
              {activeEntry?.publisher ?? '—'}
              {activeEntry?.editionNumber !== null && activeEntry?.editionNumber !== undefined
                ? ` · #${activeEntry.editionNumber}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {searchState.loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Buscando em Amazon BR → Rika → Excelsior...
              </p>
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Tentou: {searchState.triedSources.map((s) => SOURCE_LABEL[s]).join(' → ')}
                {searchState.source && (
                  <span className="ml-1 font-medium text-foreground">
                    · achou em <strong>{SOURCE_LABEL[searchState.source]}</strong>
                  </span>
                )}
              </div>

              {searchState.candidates.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-8 text-center">
                  <ImageIcon className="h-10 w-10 text-amber-500/60" />
                  <p className="text-sm">
                    Nenhuma capa encontrada nas três fontes. Tente buscar manualmente
                    ou aceitar que esta edição pode não ter capa indexada.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {searchState.candidates.map((c) => (
                    <li
                      key={`${c.source}:${c.externalRef}`}
                      className="flex flex-col rounded-md border border-border bg-card overflow-hidden"
                    >
                      <div className="aspect-[2/3] w-full overflow-hidden bg-muted">
                        <img
                          src={c.imageUrl}
                          alt={c.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-2">
                        <p className="line-clamp-2 text-xs font-medium">{c.title}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {SOURCE_LABEL[c.source]}
                        </p>
                        <div className="mt-auto flex items-center gap-1.5 pt-2">
                          <Button
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => handleApply(c)}
                            disabled={applyingUrl !== null}
                          >
                            {applyingUrl === c.imageUrl ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              'Aplicar'
                            )}
                          </Button>
                          <a
                            href={c.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted"
                            title="Abrir página de origem"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeSearch} disabled={applyingUrl !== null}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
