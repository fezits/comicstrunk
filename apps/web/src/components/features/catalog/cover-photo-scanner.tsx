'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CoverImage } from '@/components/ui/cover-image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { recognize, recordChoice, confirmCandidate, searchByText } from '@/lib/api/cover-scan';
import { compressImageToDataUri } from '@/lib/utils/compress-image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CoverScanCandidate, CoverScanIdentified } from '@comicstrunk/contracts';

type Stage =
  | 'idle'
  | 'compressing'
  | 'extracting'
  | 'editing'
  | 'searching'
  | 'results'
  | 'error';

interface EditFields {
  title: string;
  issueNumber: string;
  publisher: string;
  series: string;
  ocrText: string;
  extraTerms: string;
}

const EMPTY_FIELDS: EditFields = {
  title: '',
  issueNumber: '',
  publisher: '',
  series: '',
  ocrText: '',
  extraTerms: '',
};

interface Props {
  onChoose?: (candidate: CoverScanCandidate) => void;
  onClose?: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  metron: 'Metron',
  rika: 'Rika',
  amazon: 'Amazon BR',
  fandom: 'Fandom Wiki',
  ebay: 'eBay',
};

// Map de cores do VLM (em ingles) pra valor CSS legivel. Usado pro chip
// visual no painel "IDENTIFIQUEI COMO". Cores fora dessa lista cairao
// pro fallback gray.
const COLOR_SWATCHES: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#eab308',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  black: '#000000',
  white: '#ffffff',
  gray: '#9ca3af',
  brown: '#92400e',
  gold: '#ca8a04',
  silver: '#cbd5e1',
  beige: '#fde68a',
  cyan: '#06b6d4',
  magenta: '#d946ef',
};

export function CoverPhotoScanner({ onChoose, onClose }: Props) {
  const t = useTranslations('scanCapa');
  const [stage, setStage] = useState<Stage>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CoverScanCandidate[]>([]);
  const [identified, setIdentified] = useState<CoverScanIdentified | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [scanLogId, setScanLogId] = useState<string>('');
  const [photoDataUri, setPhotoDataUri] = useState<string>('');
  // "Capa sem texto visivel / avariada" — pula VLM textual e usa Google
  // Vision Web Detection direto. Custo extra ~R$ 0,0075/scan.
  const [forceVisualSearch, setForceVisualSearch] = useState(false);

  // Edit-before-search (Phase 4): user can refine the VLM extraction before
  // we hit the catalog/Metron/Rika.
  const [editFields, setEditFields] = useState<EditFields>(EMPTY_FIELDS);
  const [showMoreFields, setShowMoreFields] = useState(false);

  // Modal de confirmacao
  const [modalCandidate, setModalCandidate] = useState<CoverScanCandidate | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedAtRef = useRef<number>(0);

  async function handleFile(file: File) {
    setStage('compressing');
    setPreviewUrl(URL.createObjectURL(file));
    startedAtRef.current = Date.now();

    try {
      const dataUri = await compressImageToDataUri(file);
      setPhotoDataUri(dataUri);
      setStage('extracting');

      const result = await recognize({
        imageBase64: dataUri,
        durationMs: Date.now() - startedAtRef.current,
        forceVisualSearch: forceVisualSearch || undefined,
      });

      setScanLogId(result.scanLogId);
      setIdentified(result.identified);

      // Pre-populate editable fields with VLM extraction. User can correct
      // before hitting the catalog/Metron/Rika.
      setEditFields({
        title: result.identified.title ?? '',
        issueNumber:
          result.identified.issueNumber !== null
            ? String(result.identified.issueNumber)
            : '',
        publisher: result.identified.publisher ?? '',
        series: result.identified.series ?? '',
        ocrText: result.identified.ocrText ?? '',
        extraTerms: '',
      });
      setStage('editing');
    } catch (err) {
      const errAny = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
        message?: string;
      };
      const status = errAny.response?.status;
      const apiMsg = errAny.response?.data?.error?.message;
      if (status === 429) setErrorMsg(t('rateLimitMessage'));
      else if (status === 413) setErrorMsg(apiMsg || 'Imagem muito grande. Tente uma foto menor.');
      else if (apiMsg) setErrorMsg(apiMsg);
      else if (status && status >= 500) setErrorMsg(t('errorServer'));
      else setErrorMsg(errAny.message || 'unknown');
      setStage('error');
    }
  }

  async function handleSearch() {
    if (!scanLogId) return;
    const issueNum = editFields.issueNumber.trim()
      ? parseInt(editFields.issueNumber, 10)
      : undefined;

    setStage('searching');
    startedAtRef.current = Date.now();
    try {
      const result = await searchByText({
        scanLogId,
        title: editFields.title.trim() || undefined,
        issueNumber: Number.isFinite(issueNum) ? issueNum : undefined,
        publisher: editFields.publisher.trim() || undefined,
        series: editFields.series.trim() || undefined,
        ocrText: editFields.ocrText.trim() || undefined,
        extraTerms: editFields.extraTerms.trim() || undefined,
        durationMs: Date.now() - startedAtRef.current,
      });
      setCandidates(result.candidates);
      setIdentified(result.identified);
      setStage('results');
    } catch (err) {
      const errAny = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
        message?: string;
      };
      const apiMsg = errAny.response?.data?.error?.message;
      if (apiMsg) setErrorMsg(apiMsg);
      else setErrorMsg(errAny.message || 'unknown');
      setStage('error');
    }
  }

  function openConfirm(candidate: CoverScanCandidate) {
    setModalCandidate(candidate);
  }

  async function handleConfirm() {
    if (!modalCandidate || !scanLogId) return;
    setConfirming(true);
    try {
      const result = await confirmCandidate({
        scanLogId,
        candidate: {
          id: modalCandidate.id,
          slug: modalCandidate.slug,
          title: modalCandidate.title,
          publisher: modalCandidate.publisher,
          editionNumber: modalCandidate.editionNumber,
          coverImageUrl: modalCandidate.coverImageUrl,
          isExternal: modalCandidate.isExternal,
          externalSource: modalCandidate.externalSource,
          externalRef: modalCandidate.externalRef,
        },
        userPhotoBase64: photoDataUri || undefined,
      });

      // Mensagem unificada: "Gibi adicionado à sua coleção" tanto pro caso
      // novo quanto pro ja-existia (Fernando pediu — UX consistente).
      toast.success(result.message);
      onChoose?.(modalCandidate);
      setModalCandidate(null);
      reset();
    } catch (err) {
      const errAny = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
        message?: string;
      };
      const apiMsg = errAny.response?.data?.error?.message;
      toast.error(apiMsg || errAny.message || t('errorGeneric'));
    } finally {
      setConfirming(false);
    }
  }

  async function handleNoneMatch() {
    if (scanLogId) {
      await recordChoice({ scanLogId, chosenEntryId: null }).catch(() => {});
    }
    reset();
  }

  function reset() {
    setStage('idle');
    setPreviewUrl(null);
    setPhotoDataUri('');
    setCandidates([]);
    setIdentified(null);
    setErrorMsg('');
    setScanLogId('');
    setEditFields(EMPTY_FIELDS);
    setShowMoreFields(false);
  }

  const canSearch =
    !!editFields.title.trim() ||
    !!editFields.publisher.trim() ||
    !!editFields.series.trim() ||
    !!editFields.ocrText.trim() ||
    !!editFields.extraTerms.trim();

  return (
    <div className="space-y-4">
      {stage === 'idle' && (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8">
            <p className="text-sm text-muted-foreground">{t('uploadHint')}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button onClick={() => fileInputRef.current?.click()}>{t('chooseFile')}</Button>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm cursor-pointer hover:bg-card">
            <Checkbox
              checked={forceVisualSearch}
              onCheckedChange={(c) => setForceVisualSearch(c === true)}
            />
            <span>
              Capa sem texto visível ou difícil de ler
              <span className="ml-1 text-xs text-muted-foreground">
                (usa busca por imagem do Google)
              </span>
            </span>
          </label>
        </div>
      )}

      {(stage === 'compressing' || stage === 'extracting' || stage === 'searching') && (
        <div className="flex flex-col items-center gap-4 py-4">
          {previewUrl && (
            <div className="relative">
              <img
                src={previewUrl}
                alt={t('preview')}
                width={220}
                height={330}
                className="rounded border object-contain shadow-lg"
              />
              {/* Pulsing border */}
              <div className="pointer-events-none absolute inset-0 animate-pulse rounded border-2 border-primary/60" />
              {/* Scanning sweep line */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded">
                <div className="scan-capa-sweep absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-primary/40 to-transparent" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>
              {stage === 'compressing'
                ? t('compressing')
                : stage === 'extracting'
                  ? t('analyzing')
                  : t('searching')}
            </span>
          </div>
        </div>
      )}

      {stage === 'editing' && (
        <div className="space-y-3">
          {(previewUrl || (identified && identified.title)) && (
            <div className="flex items-stretch gap-3 rounded border border-primary/30 bg-primary/5 p-3">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={t('preview')}
                  className="h-24 w-16 flex-none rounded border object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('editingTitle')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/80">{t('editingHint')}</p>
                {identified?.dominantColors && identified.dominantColors.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Cores
                    </span>
                    <div className="flex items-center gap-1">
                      {identified.dominantColors.map((c) => (
                        <span
                          key={c}
                          title={c}
                          className="h-3.5 w-3.5 rounded-full border border-border/60"
                          style={{ backgroundColor: COLOR_SWATCHES[c] ?? '#9ca3af' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="scan-edit-title">
                {t('fieldTitle')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scan-edit-title"
                value={editFields.title}
                onChange={(e) => setEditFields({ ...editFields, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scan-edit-issue">{t('fieldIssueNumber')}</Label>
              <Input
                id="scan-edit-issue"
                type="number"
                min={0}
                className="w-32"
                value={editFields.issueNumber}
                onChange={(e) => setEditFields({ ...editFields, issueNumber: e.target.value })}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowMoreFields((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {showMoreFields ? t('hideMoreFields') : t('showMoreFields')}
            </button>

            {showMoreFields && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scan-edit-publisher">{t('fieldPublisher')}</Label>
                  <Input
                    id="scan-edit-publisher"
                    value={editFields.publisher}
                    onChange={(e) =>
                      setEditFields({ ...editFields, publisher: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scan-edit-series">{t('fieldSeries')}</Label>
                  <Input
                    id="scan-edit-series"
                    value={editFields.series}
                    onChange={(e) => setEditFields({ ...editFields, series: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scan-edit-ocr">{t('fieldOcrText')}</Label>
                  <Textarea
                    id="scan-edit-ocr"
                    rows={3}
                    value={editFields.ocrText}
                    onChange={(e) =>
                      setEditFields({ ...editFields, ocrText: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scan-edit-extra">{t('fieldExtraTerms')}</Label>
                  <Textarea
                    id="scan-edit-extra"
                    rows={2}
                    placeholder={t('fieldExtraTermsPlaceholder')}
                    value={editFields.extraTerms}
                    onChange={(e) =>
                      setEditFields({ ...editFields, extraTerms: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleSearch}
              disabled={!canSearch}
              className="w-full"
              size="lg"
            >
              {t('buttonSearch')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'results' && (
        <div className="space-y-3">
          {(previewUrl || (identified && identified.title)) && (
            <div className="flex items-stretch gap-3 rounded border border-primary/30 bg-primary/5 p-3 text-sm">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt={t('preview')}
                  className="h-24 w-16 flex-none rounded border object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {t('identifiedAs')}
                </p>
                {identified && identified.title ? (
                  <>
                    <p className="mt-1 line-clamp-2 font-medium">
                      {identified.title}
                      {identified.issueNumber !== null && identified.issueNumber !== undefined && (
                        <span className="text-muted-foreground"> #{identified.issueNumber}</span>
                      )}
                    </p>
                    {(identified.publisher || identified.series) && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {[identified.series, identified.publisher].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    {identified.dominantColors && identified.dominantColors.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Cores
                        </span>
                        <div className="flex items-center gap-1">
                          {identified.dominantColors.map((c) => (
                            <span
                              key={c}
                              title={c}
                              className="h-3.5 w-3.5 rounded-full border border-border/60"
                              style={{ backgroundColor: COLOR_SWATCHES[c] ?? '#9ca3af' }}
                            />
                          ))}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {identified.dominantColors.join(', ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{t('noIdentification')}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {t('foundCount', { count: candidates.length })}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setStage('editing')}>
                {t('editAndSearchAgain')}
              </Button>
              <Button variant="ghost" size="sm" onClick={reset}>
                {t('tryAgain')}
              </Button>
            </div>
          </div>

          {candidates.length === 0 ? (
            <p className="rounded border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              {t('noMatches')}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openConfirm(c)}
                    className={`block w-full rounded border-2 bg-card p-2 text-left transition-colors hover:border-primary ${
                      c.isExternal
                        ? 'border-amber-500 border-dashed bg-amber-500/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="aspect-[2/3] w-full overflow-hidden rounded">
                      <CoverImage
                        src={c.coverImageUrl}
                        alt={c.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-medium">{c.title}</p>
                    {c.publisher && (
                      <p className="text-xs text-muted-foreground">{c.publisher}</p>
                    )}
                    {c.isExternal && c.externalSource && (
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-amber-600">
                        Fonte externa · {SOURCE_LABEL[c.externalSource] ?? c.externalSource}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" onClick={handleNoneMatch} className="w-full">
            {t('noneMatch')}
          </Button>
        </div>
      )}

      {stage === 'error' && (
        <div className="space-y-3">
          <p className="rounded border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {errorMsg || t('errorGeneric')}
          </p>
          <Button onClick={reset} className="w-full">
            {t('tryAgain')}
          </Button>
        </div>
      )}

      {onClose &&
        stage !== 'compressing' &&
        stage !== 'extracting' &&
        stage !== 'searching' && (
          <Button variant="ghost" onClick={onClose} className="w-full">
            {t('close')}
          </Button>
        )}

      {/* Modal de confirmacao */}
      <Dialog
        open={!!modalCandidate}
        onOpenChange={(open) => {
          if (!open && !confirming) setModalCandidate(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Deseja adicionar este gibi à sua coleção?</DialogTitle>
          </DialogHeader>

          {modalCandidate && (
            <div className="flex gap-5">
              <div className="aspect-[2/3] w-48 flex-none overflow-hidden rounded border bg-muted shadow-md">
                {modalCandidate.coverImageUrl ? (
                  <img
                    src={modalCandidate.coverImageUrl}
                    alt={modalCandidate.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <dl className="flex-1 space-y-3 text-base">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Título</dt>
                  <dd className="text-lg font-semibold leading-snug">{modalCandidate.title}</dd>
                </div>
                {modalCandidate.publisher && (
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">Editora</dt>
                    <dd>{modalCandidate.publisher}</dd>
                  </div>
                )}
                {modalCandidate.editionNumber !== null &&
                  modalCandidate.editionNumber !== undefined && (
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                        Edição
                      </dt>
                      <dd>#{modalCandidate.editionNumber}</dd>
                    </div>
                  )}
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Origem</dt>
                  <dd className="text-sm">
                    {modalCandidate.isExternal && modalCandidate.externalSource
                      ? `Externa: ${SOURCE_LABEL[modalCandidate.externalSource] ?? modalCandidate.externalSource} (será importada)`
                      : 'Catálogo interno'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setModalCandidate(null)}
              disabled={confirming}
            >
              Cancelar
            </Button>
            <Button size="lg" onClick={handleConfirm} disabled={confirming}>
              {confirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Adicionar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
