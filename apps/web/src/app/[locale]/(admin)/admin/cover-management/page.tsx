'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  ImageIcon,
  ExternalLink,
  Layers,
  CheckCircle2,
} from 'lucide-react';
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
  previewBulkSeriesCovers,
  bulkApplyCovers,
  fandomFromUrl,
} from '@/lib/api/admin-cover-management';
import type {
  AdminMissingCoverEntry,
  AdminCoverCandidate,
  AdminCoverSource,
  AdminBulkPreviewResponse,
  AdminBulkSource,
} from '@comicstrunk/contracts';

const LIMIT = 30;

const SOURCE_LABEL: Record<AdminCoverSource, string> = {
  amazon: 'Amazon BR',
  rika: 'Rika',
  excelsior: 'Excelsior Comics',
  fandom: 'Fandom Wiki',
  ebay: 'eBay',
  metron: 'MetronDB',
  imagecomics: 'Image Comics',
};

interface SearchState {
  loading: boolean;
  source: AdminCoverSource | null;
  triedSources: AdminCoverSource[];
  candidates: AdminCoverCandidate[];
}

type Mode = 'closed' | 'detail' | 'search' | 'bulk';

/**
 * Detecta se um candidato suporta "Toda a série" — pra Fandom (extrai
 * wikiDomain + pageTitle do externalRef) ou Image Comics (extrai slug
 * do releaseSlug). Retorna { source, sourceUrl, label } pronto pra
 * mostrar tooltip e chamar API generica.
 */
function bulkInfoFromCandidate(
  c: AdminCoverCandidate,
): { source: AdminBulkSource; sourceUrl: string; label: string } | null {
  if (c.source === 'fandom') {
    const [wikiDomain] = c.externalRef.split('|');
    if (!wikiDomain) return null;
    const m = c.title.match(/^(.+)\s+(\d+)$/);
    if (!m) return null;
    const seriesPageTitle = m[1].trim();
    if (!seriesPageTitle) return null;
    const sourceUrl = `https://${wikiDomain}/wiki/${encodeURIComponent(seriesPageTitle.replace(/ /g, '_'))}`;
    return { source: 'fandom', sourceUrl, label: seriesPageTitle };
  }
  if (c.source === 'imagecomics') {
    // externalRef = releaseSlug ("birthright-50") -> series slug ("birthright")
    const m = c.externalRef.match(/^(.+)-(\d+)$/);
    if (!m) return null;
    const slug = m[1];
    const sourceUrl = `https://imagecomics.com/comics/series/${slug}`;
    return { source: 'imagecomics', sourceUrl, label: slug };
  }
  return null;
}

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

  // Modo bulk (a partir de candidato Fandom OU Image Comics)
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<AdminBulkPreviewResponse | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkApplying, setBulkApplying] = useState(false);

  // Input "Cole URL Fandom" — fallback quando cascata nao acha o issue/serie certa
  const [fandomUrlInput, setFandomUrlInput] = useState('');
  const [fandomUrlLoading, setFandomUrlLoading] = useState(false);

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
    if (applyingUrl || bulkApplying) return;
    setMode('closed');
    setActiveEntry(null);
    setSearchState({ loading: false, source: null, triedSources: [], candidates: [] });
    setBulkPreview(null);
    setBulkSelected(new Set());
    setBulkLoading(false);
  };

  /**
   * A partir de um candidate Fandom OU Image Comics, oferece aplicar a serie
   * inteira: extrai info da serie da fonte, chama bulk preview generico.
   */
  const startBulkFromCandidate = async (candidate: AdminCoverCandidate) => {
    if (!activeEntry) return;
    if (!activeEntry.seriesId) {
      toast.error('Esta entrada não está associada a uma série no catálogo.');
      return;
    }
    const info = bulkInfoFromCandidate(candidate);
    if (!info) {
      toast.error('Esse candidato não permite aplicar à série toda.');
      return;
    }
    setMode('bulk');
    setBulkLoading(true);
    setBulkPreview(null);
    try {
      const result = await previewBulkSeriesCovers({
        catalogSeriesId: activeEntry.seriesId,
        source: info.source,
        sourceUrl: info.sourceUrl,
      });
      setBulkPreview(result);
      // Pre-seleciona todos com capa
      setBulkSelected(
        new Set(result.matched.filter((m) => m.sourceCoverUrl).map((m) => m.entryId)),
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message ?? 'Erro ao buscar matches da série');
      setMode('search');
    } finally {
      setBulkLoading(false);
    }
  };

  /**
   * Resolve URL Fandom colada pelo admin. Detecta se eh issue (URL termina em
   * numero) ou serie:
   *   - Issue: append candidate na lista de candidatos do search modal
   *   - Serie: dispara bulk preview direto
   */
  const handleFandomUrlLookup = async () => {
    const url = fandomUrlInput.trim();
    if (!url || !activeEntry) return;
    setFandomUrlLoading(true);
    try {
      const result = await fandomFromUrl({ url });
      if (result.type === 'issue') {
        // Append na lista de candidatos (ou substitui se vazia). Mantem ordem
        // colocando o candidato manual no topo.
        setSearchState((prev) => ({
          ...prev,
          candidates: [result.candidate, ...prev.candidates],
        }));
        setMode('search');
        setFandomUrlInput('');
        toast.success('Issue Fandom adicionada aos candidatos.');
      } else {
        // Serie: dispara bulk preview com a URL
        if (!activeEntry.seriesId) {
          toast.error('Esta entrada não está associada a uma série no catálogo.');
          return;
        }
        setMode('bulk');
        setBulkLoading(true);
        setBulkPreview(null);
        const preview = await previewBulkSeriesCovers({
          catalogSeriesId: activeEntry.seriesId,
          source: 'fandom',
          sourceUrl: result.fandomSeriesUrl,
        });
        setBulkPreview(preview);
        setBulkSelected(
          new Set(preview.matched.filter((m) => m.sourceCoverUrl).map((m) => m.entryId)),
        );
        setFandomUrlInput('');
        setBulkLoading(false);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message ?? 'Erro ao processar URL Fandom');
      setBulkLoading(false);
    } finally {
      setFandomUrlLoading(false);
    }
  };

  const toggleBulkSelected = (entryId: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const handleBulkApply = async () => {
    if (!bulkPreview || bulkSelected.size === 0) return;
    setBulkApplying(true);
    try {
      const items = bulkPreview.matched
        .filter((m) => bulkSelected.has(m.entryId) && m.sourceCoverUrl)
        .map((m) => ({ entryId: m.entryId, imageUrl: m.sourceCoverUrl as string }));
      const result = await bulkApplyCovers({ items });
      toast.success(
        `${result.applied.length} capa(s) aplicada(s)${result.failed.length ? ` · ${result.failed.length} falha(s)` : ''}`,
      );
      // Remove os aplicados da lista principal e do preview
      const appliedIds = new Set(result.applied.map((a) => a.entryId));
      setItems((prev) => prev.filter((x) => !appliedIds.has(x.id)));
      setTotal((t) => t - result.applied.length);
      setBulkPreview({
        ...bulkPreview,
        matched: bulkPreview.matched.filter((m) => !appliedIds.has(m.entryId)),
      });
      setBulkSelected(new Set());
      // Se aplicou tudo da preview, fecha o modal
      const remaining = bulkPreview.matched.filter((m) => !appliedIds.has(m.entryId)).length;
      if (remaining === 0) closeModal();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message ?? 'Erro no apply em batch');
    } finally {
      setBulkApplying(false);
    }
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
          sem capa. Clique em qualquer linha para ver detalhes; em &quot;Buscar capas&quot;
          para tentar nas 6 fontes. Ao encontrar um candidato Fandom certo, use{' '}
          <strong>Toda a série</strong> pra aplicar capas em batch.
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
                    {entry.publishYear ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({entry.publishYear})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.publisher ?? '—'}
                    {entry.imprint && (
                      <span className="ml-1 text-xs">/ {entry.imprint}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.editionNumber ? `#${entry.editionNumber}` : '—'}
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
              {activeEntry?.publishYear ? (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({activeEntry.publishYear})
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {[
                activeEntry?.publisher,
                activeEntry?.imprint,
                activeEntry?.editionNumber ? `#${activeEntry.editionNumber}` : null,
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
                <DetailField
                  label="Volume"
                  value={activeEntry.volumeNumber ? activeEntry.volumeNumber.toString() : null}
                />
                <DetailField
                  label="Edição"
                  value={activeEntry.editionNumber ? activeEntry.editionNumber.toString() : null}
                />
                <DetailField
                  label="Ano"
                  value={activeEntry.publishYear ? activeEntry.publishYear.toString() : null}
                />
                <DetailField
                  label="Páginas"
                  value={activeEntry.pageCount ? activeEntry.pageCount.toString() : null}
                />
                <DetailField
                  label="Preço de capa"
                  value={
                    typeof activeEntry.coverPrice === 'number' && activeEntry.coverPrice > 0
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

              {/* Fallback manual: cola URL Fandom se a cascata nao achou o certo */}
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Não achou o gibi certo? Cole URL Fandom específica (issue ou série):
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={fandomUrlInput}
                    onChange={(e) => setFandomUrlInput(e.target.value)}
                    placeholder="https://dc.fandom.com/wiki/Superman_Vol_2_190"
                    className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
                    disabled={fandomUrlLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && fandomUrlInput.trim()) {
                        e.preventDefault();
                        handleFandomUrlLookup();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleFandomUrlLookup}
                    disabled={!fandomUrlInput.trim() || fandomUrlLoading}
                  >
                    {fandomUrlLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Buscar'
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Termina em número (ex: <code>_190</code>) → adiciona 1 candidato.
                  Sem número (ex: <code>Superman_Vol_2</code>) → abre &quot;Toda a
                  série&quot;.
                </p>
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
                  {searchState.candidates.map((c) => {
                    const bulkInfo = bulkInfoFromCandidate(c);
                    return (
                      <li
                        key={`${c.source}:${c.externalRef}`}
                        className="flex flex-col rounded-md border border-border bg-card overflow-hidden"
                      >
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-[2/3] w-full overflow-hidden bg-muted transition-opacity hover:opacity-80"
                          title="Abrir página de origem em nova aba"
                        >
                          <img
                            src={c.imageUrl}
                            alt={c.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </a>
                        <div className="flex flex-1 flex-col gap-1 p-2">
                          <a
                            href={c.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="line-clamp-2 text-xs font-medium hover:underline"
                            title="Abrir página de origem em nova aba"
                          >
                            {c.title}
                          </a>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {SOURCE_LABEL[c.source]}
                          </p>
                          <div className="mt-auto flex flex-col gap-1.5 pt-2">
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => handleApply(c)}
                                disabled={applyingUrl !== null}
                              >
                                {applyingUrl === c.imageUrl ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  'Aplicar só este'
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
                            {bulkInfo && activeEntry?.seriesId && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs"
                                onClick={() => startBulkFromCandidate(c)}
                                disabled={applyingUrl !== null}
                                title={`Aplicar capas de ${bulkInfo.label} em todas as entries da série ${activeEntry.seriesTitle ?? ''}`}
                              >
                                <Layers className="mr-1 h-3 w-3" />
                                Toda a série
                              </Button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {/* === Modo BULK: preview de match Fandom-serie === */}
          {mode === 'bulk' && (
            <div className="space-y-3">
              {bulkLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Buscando issues da série na Fandom...
                  </p>
                </div>
              ) : bulkPreview ? (
                <>
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">
                      {bulkPreview.catalogSeriesTitle} ←{' '}
                      <code className="text-xs">{bulkPreview.sourceSeriesIdentifier}</code>
                      <span className="ml-2 text-xs uppercase tracking-wider text-muted-foreground">
                        {bulkPreview.source === 'fandom' ? 'Fandom Wiki' : 'Image Comics'}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {bulkPreview.totalIssuesSource} issues na fonte ·{' '}
                      {bulkPreview.totalEntriesMissing} entries do catálogo sem capa ·{' '}
                      {bulkPreview.matched.length} matches por número (
                      {bulkPreview.matched.filter((m) => m.sourceCoverUrl).length} com capa) ·{' '}
                      {bulkPreview.unmatchedEntries.length} entries sem match
                    </p>
                  </div>

                  {bulkPreview.matched.filter((m) => m.sourceCoverUrl).length === 0 ? (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-6 text-center text-sm">
                      Nenhuma capa disponível pra essa série na fonte selecionada.
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm">
                          {bulkSelected.size} selecionado(s) de{' '}
                          {bulkPreview.matched.filter((m) => m.sourceCoverUrl).length} com capa
                        </p>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setBulkSelected(
                                new Set(
                                  bulkPreview.matched
                                    .filter((m) => m.sourceCoverUrl)
                                    .map((m) => m.entryId),
                                ),
                              )
                            }
                          >
                            Selecionar todos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBulkSelected(new Set())}
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>

                      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                        {bulkPreview.matched
                          .filter((m) => m.sourceCoverUrl)
                          .map((m) => {
                            const isSelected = bulkSelected.has(m.entryId);
                            return (
                              <li
                                key={m.entryId}
                                className={`flex flex-col rounded-md border-2 bg-card overflow-hidden transition-colors ${
                                  isSelected ? 'border-primary' : 'border-border'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleBulkSelected(m.entryId)}
                                  className="relative block aspect-[2/3] w-full overflow-hidden bg-muted"
                                >
                                  <img
                                    src={m.sourceCoverUrl as string}
                                    alt={m.entryTitle}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                  {isSelected && (
                                    <div className="absolute right-1 top-1 rounded-full bg-primary p-1 text-primary-foreground">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                  )}
                                </button>
                                <div className="px-1.5 py-1 space-y-0.5">
                                  <p className="line-clamp-2 text-[11px] font-medium">
                                    {m.entryTitle}
                                    {m.entryEditionNumber ? (
                                      <span className="ml-1 text-muted-foreground">
                                        #{m.entryEditionNumber}
                                      </span>
                                    ) : null}
                                  </p>
                                  <a
                                    href={m.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="line-clamp-1 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                                    title="Abrir página da fonte"
                                  >
                                    {m.sourcePageTitle}
                                  </a>
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    </>
                  )}
                </>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === 'detail' && activeEntry && (
              <Button onClick={() => startSearch(activeEntry)} className="sm:mr-auto">
                <Search className="mr-1.5 h-4 w-4" />
                Buscar capas
              </Button>
            )}
            {mode === 'bulk' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setMode('search')}
                  className="sm:mr-auto"
                  disabled={bulkApplying}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Voltar para candidatos
                </Button>
                {bulkPreview && bulkSelected.size > 0 && (
                  <Button onClick={handleBulkApply} disabled={bulkApplying}>
                    {bulkApplying ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Aplicando {bulkSelected.size}...
                      </>
                    ) : (
                      `Aplicar ${bulkSelected.size} capa(s)`
                    )}
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={applyingUrl !== null || bulkApplying}
            >
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
