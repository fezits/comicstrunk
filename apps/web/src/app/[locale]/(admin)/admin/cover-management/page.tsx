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
  fandom: 'Fandom Wiki',
  ebay: 'eBay',
  metron: 'MetronDB',
};

interface SearchState {
  loading: boolean;
  source: AdminCoverSource | null;
  triedSources: AdminCoverSource[];
  candidates: AdminCoverCandidate[];
}

type Mode = 'closed' | 'detail' | 'search';

export default function AdminCoverManagementPage() {
  const [items, setItems] = useState<AdminMissingCoverEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [publisher, setPublisher] = useState<string>('');
  const [publishers, setPublishers] = useState<Array<{ publisher: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);

  // Modal: 'detail' (info do entry) ou 'search' (cascata + candidatos)
  const [mode, setMode] = useState<Mode>('closed');
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

  const openDetail = (entry: AdminMissingCoverEntry) => {
    setActiveEntry(entry);
    setMode('detail');
  };

  const startSearch = async (entry: AdminMissingCoverEntry) => {
    setActiveEntry(entry);
    setMode('search');
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

  const closeModal = () => {
    if (applyingUrl) return;
    setMode('closed');
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
      setItems((prev) => prev.filter((x) => x.id !== activeEntry.id));
      setTotal((t) => t - 1);
      closeModal();
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
          sem capa. Clique em qualquer linha para ver detalhes; em &quot;Buscar capas&quot; para
          tentar nas 6 fontes (Amazon → Rika → Excelsior → Fandom → eBay → Metron).
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
                <tr
                  key={entry.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                  onClick={() => openDetail(entry)}
                >
                  <td className="px-3 py-2">
                    <span>{entry.title}</span>
                    {entry.publishYear !== null && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({entry.publishYear})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.publisher ?? '—'}
                    {entry.imprint && (
                      <span className="ml-1 text-xs">/ {entry.imprint}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.editionNumber !== null ? `#${entry.editionNumber}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {entry.approvalStatus}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        startSearch(entry);
                      }}
                    >
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

      {/* Modal — detail OU search */}
      <Dialog
        open={mode !== 'closed'}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeEntry?.title}
              {activeEntry?.publishYear !== null && activeEntry?.publishYear !== undefined && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({activeEntry.publishYear})
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {[
                activeEntry?.publisher,
                activeEntry?.imprint,
                activeEntry?.editionNumber !== null && activeEntry?.editionNumber !== undefined
                  ? `#${activeEntry.editionNumber}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </DialogDescription>
          </DialogHeader>

          {/* === Modo DETAIL: ficha completa do entry === */}
          {mode === 'detail' && activeEntry && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
                <DetailField label="Série" value={activeEntry.seriesTitle} />
                <DetailField label="Volume" value={activeEntry.volumeNumber?.toString() ?? null} />
                <DetailField label="Edição" value={activeEntry.editionNumber?.toString() ?? null} />
                <DetailField label="Ano" value={activeEntry.publishYear?.toString() ?? null} />
                <DetailField label="Páginas" value={activeEntry.pageCount?.toString() ?? null} />
                <DetailField
                  label="Preço de capa"
                  value={
                    activeEntry.coverPrice !== null
                      ? `R$ ${activeEntry.coverPrice.toFixed(2)}`
                      : null
                  }
                />
                <DetailField label="Autor" value={activeEntry.author} />
                <DetailField label="ISBN" value={activeEntry.isbn} />
                <DetailField label="Código de barras" value={activeEntry.barcode} />
                <DetailField
                  label="Slug"
                  value={activeEntry.slug}
                  className="md:col-span-2 break-all"
                />
                <DetailField label="Source" value={activeEntry.sourceKey} />
                <DetailField label="Status" value={activeEntry.approvalStatus} />
                <DetailField
                  label="Criado em"
                  value={new Date(activeEntry.createdAt).toLocaleString('pt-BR')}
                />
              </dl>
              {activeEntry.description && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Descrição
                  </p>
                  <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm">
                    {activeEntry.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* === Modo SEARCH: cascata + candidatos === */}
          {mode === 'search' && searchState.loading && (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Buscando em Amazon → Rika → Excelsior → Fandom → eBay → Metron...
              </p>
            </div>
          )}

          {mode === 'search' && !searchState.loading && (
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
                    Nenhuma capa encontrada nas fontes configuradas. Tente buscar
                    manualmente ou aceitar que esta edição pode não ter capa indexada.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === 'detail' && activeEntry && (
              <Button
                onClick={() => startSearch(activeEntry)}
                className="sm:mr-auto"
              >
                <Search className="mr-1.5 h-4 w-4" />
                Buscar capas
              </Button>
            )}
            <Button variant="outline" onClick={closeModal} disabled={applyingUrl !== null}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? '—'}</dd>
    </div>
  );
}
