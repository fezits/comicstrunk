'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  listSeriesWithMissingCovers,
  previewBulkFandomCovers,
  bulkApplyCovers,
} from '@/lib/api/admin-cover-management';
import type {
  AdminSeriesWithMissingCovers,
  AdminBulkFandomPreviewResponse,
  AdminBulkApplyResponse,
} from '@comicstrunk/contracts';

export default function AdminBulkFandomPage() {
  const [series, setSeries] = useState<AdminSeriesWithMissingCovers[]>([]);
  const [seriesId, setSeriesId] = useState<string>('');
  const [fandomUrl, setFandomUrl] = useState<string>('');

  const [loadingSeries, setLoadingSeries] = useState(true);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<AdminBulkFandomPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<AdminBulkApplyResponse | null>(null);

  useEffect(() => {
    listSeriesWithMissingCovers()
      .then((s) => setSeries(s))
      .catch(() => toast.error('Erro ao carregar séries'))
      .finally(() => setLoadingSeries(false));
  }, []);

  const handleSearch = async () => {
    if (!seriesId || !fandomUrl) {
      toast.error('Selecione uma série e cole a URL Fandom');
      return;
    }
    setSearching(true);
    setPreview(null);
    setApplyResult(null);
    try {
      const result = await previewBulkFandomCovers({
        catalogSeriesId: seriesId,
        fandomSeriesUrl: fandomUrl,
      });
      setPreview(result);
      // Pre-seleciona TODOS que tem capa
      const initial = new Set<string>(
        result.matched.filter((m) => m.fandomCoverUrl).map((m) => m.entryId),
      );
      setSelected(initial);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message ?? 'Erro ao buscar matches');
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (entryId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const selectAllWithCover = () => {
    if (!preview) return;
    setSelected(new Set(preview.matched.filter((m) => m.fandomCoverUrl).map((m) => m.entryId)));
  };

  const selectNone = () => setSelected(new Set());

  const handleApply = async () => {
    if (!preview || selected.size === 0) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const items = preview.matched
        .filter((m) => selected.has(m.entryId) && m.fandomCoverUrl)
        .map((m) => ({ entryId: m.entryId, imageUrl: m.fandomCoverUrl as string }));
      const result = await bulkApplyCovers({ items });
      setApplyResult(result);
      toast.success(
        `${result.applied.length} capa(s) aplicada(s)${result.failed.length ? `, ${result.failed.length} falha(s)` : ''}`,
      );
      // Remove os aplicados do preview pra evitar reaplicar
      const appliedIds = new Set(result.applied.map((a) => a.entryId));
      setPreview({
        ...preview,
        matched: preview.matched.filter((m) => !appliedIds.has(m.entryId)),
      });
      setSelected(new Set());
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message ?? 'Erro no batch apply');
    } finally {
      setApplying(false);
    }
  };

  const matchedWithCover = preview?.matched.filter((m) => m.fandomCoverUrl) ?? [];
  const matchedWithoutCover = preview?.matched.filter((m) => !m.fandomCoverUrl) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/cover-management"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Buscar Capas Faltantes
        </Link>
        <h1 className="text-2xl font-bold">Bulk de capas via Fandom (por série)</h1>
        <p className="text-sm text-muted-foreground">
          Selecione uma série do catálogo, cole a URL da página Fandom da série, e aplique as
          capas em batch via match por número de edição.
        </p>
      </div>

      {/* Step 1: Inputs */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Série do catálogo</label>
          <select
            value={seriesId}
            onChange={(e) => setSeriesId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={loadingSeries}
          >
            <option value="">
              {loadingSeries ? 'Carregando...' : `— escolha (${series.length} com missing) —`}
            </option>
            {series.map((s) => (
              <option key={s.seriesId} value={s.seriesId}>
                {s.seriesTitle}
                {s.publisher ? ` · ${s.publisher}` : ''} ({s.missingCount} missing)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">URL Fandom da série</label>
          <input
            type="url"
            value={fandomUrl}
            onChange={(e) => setFandomUrl(e.target.value)}
            placeholder="https://dc.fandom.com/wiki/The_Flash_Vol_2"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Formato: <code>https://&lt;wiki&gt;.fandom.com/wiki/Nome_Da_Série</code>. Ex:{' '}
            <code>dc.fandom.com</code>, <code>marvel.fandom.com</code>.
          </p>
        </div>

        <Button onClick={handleSearch} disabled={searching || !seriesId || !fandomUrl}>
          {searching ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Buscando matches...
            </>
          ) : (
            <>
              <Search className="mr-1.5 h-4 w-4" />
              Buscar matches
            </>
          )}
        </Button>
      </div>

      {/* Step 2: Preview matches */}
      {preview && (
        <>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p className="font-medium">{preview.catalogSeriesTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {preview.totalIssuesFandom} issues na Fandom (
              <code>{preview.fandomSeriesPageTitle}</code>) · {preview.totalEntriesMissing}{' '}
              entries do catálogo sem capa · {preview.matched.length} matches por número (
              {matchedWithCover.length} com capa, {matchedWithoutCover.length} sem capa) ·{' '}
              {preview.unmatchedEntries.length} entries sem match na Fandom
            </p>
          </div>

          {/* Tabela de matches com capa */}
          {matchedWithCover.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  Matches com capa Fandom ({selected.size} de {matchedWithCover.length}{' '}
                  selecionados)
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllWithCover}>
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>
                    Limpar
                  </Button>
                  <Button
                    onClick={handleApply}
                    disabled={applying || selected.size === 0}
                    size="sm"
                  >
                    {applying ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      `Aplicar ${selected.size} capa(s)`
                    )}
                  </Button>
                </div>
              </div>

              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {matchedWithCover.map((m) => {
                  const isSelected = selected.has(m.entryId);
                  return (
                    <li
                      key={m.entryId}
                      className={`flex flex-col rounded-md border-2 bg-card overflow-hidden transition-colors ${
                        isSelected ? 'border-primary' : 'border-border'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelect(m.entryId)}
                        className="block aspect-[2/3] w-full overflow-hidden bg-muted relative"
                      >
                        <img
                          src={m.fandomCoverUrl as string}
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
                      <div className="flex flex-col gap-1 p-2">
                        <p className="line-clamp-2 text-xs font-medium">
                          {m.entryTitle}
                          {m.entryEditionNumber ? (
                            <span className="ml-1 text-muted-foreground">
                              #{m.entryEditionNumber}
                            </span>
                          ) : null}
                        </p>
                        <a
                          href={m.fandomUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          Fandom
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Sem capa Fandom */}
          {matchedWithoutCover.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">
                <AlertCircle className="mr-1 inline-block h-4 w-4 text-amber-500" />
                {matchedWithoutCover.length} match(es) sem capa na página Fandom
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {matchedWithoutCover.slice(0, 10).map((m) => (
                  <li key={m.entryId}>
                    #{m.entryEditionNumber} — {m.entryTitle} (
                    <a
                      href={m.fandomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Fandom
                    </a>
                    )
                  </li>
                ))}
                {matchedWithoutCover.length > 10 && (
                  <li className="italic">... e mais {matchedWithoutCover.length - 10}</li>
                )}
              </ul>
            </div>
          )}

          {/* Sem match */}
          {preview.unmatchedEntries.length > 0 && (
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-sm font-medium">
                <ImageIcon className="mr-1 inline-block h-4 w-4 text-muted-foreground" />
                {preview.unmatchedEntries.length} entries sem match (sem número de edição ou
                número não existe na Fandom)
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {preview.unmatchedEntries.slice(0, 10).map((e) => (
                  <li key={e.entryId}>
                    {e.entryEditionNumber ? `#${e.entryEditionNumber} — ` : '(sem número) '}
                    {e.entryTitle}
                  </li>
                ))}
                {preview.unmatchedEntries.length > 10 && (
                  <li className="italic">
                    ... e mais {preview.unmatchedEntries.length - 10}
                  </li>
                )}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Step 3: Resultado do apply */}
      {applyResult && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="font-medium">
            ✅ {applyResult.applied.length} capa(s) aplicada(s)
            {applyResult.failed.length > 0 ? ` · ❌ ${applyResult.failed.length} falha(s)` : ''}
          </p>
          {applyResult.failed.length > 0 && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Ver falhas</summary>
              <ul className="mt-1 space-y-0.5">
                {applyResult.failed.map((f) => (
                  <li key={f.entryId}>
                    {f.entryId}: {f.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
