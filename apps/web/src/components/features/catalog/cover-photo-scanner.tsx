'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { recognize, recordChoice, confirmCandidate } from '@/lib/api/cover-scan';
import { compressImageToDataUri } from '@/lib/utils/compress-image';
import type { CoverScanCandidate, CoverScanIdentified } from '@comicstrunk/contracts';

type Stage = 'idle' | 'compressing' | 'analyzing' | 'searching' | 'results' | 'error';

interface Props {
  onChoose?: (candidate: CoverScanCandidate) => void;
  onClose?: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  metron: 'Metron',
  rika: 'Rika',
  amazon: 'Amazon BR',
  fandom: 'Fandom Wiki',
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
      setStage('analyzing');

      const result = await recognize({
        imageBase64: dataUri,
        durationMs: Date.now() - startedAtRef.current,
      });

      setCandidates(result.candidates);
      setScanLogId(result.scanLogId);
      setIdentified(result.identified ?? null);
      setStage('results');
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
  }

  return (
    <div className="space-y-4">
      {stage === 'idle' && (
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
      )}

      {(stage === 'compressing' || stage === 'analyzing' || stage === 'searching') && (
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
                : stage === 'analyzing'
                  ? t('analyzing')
                  : t('searching')}
            </span>
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
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">{t('noIdentification')}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('foundCount', { count: candidates.length })}
            </p>
            <Button variant="ghost" size="sm" onClick={reset}>
              {t('tryAgain')}
            </Button>
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
        stage !== 'analyzing' &&
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
