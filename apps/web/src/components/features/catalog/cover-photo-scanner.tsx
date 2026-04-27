'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { CoverImage } from '@/components/ui/cover-image';
import { recognize, recordChoice, importExternal } from '@/lib/api/cover-scan';
import { compressImageToDataUri } from '@/lib/utils/compress-image';
import type { CoverScanCandidate, CoverScanIdentified } from '@comicstrunk/contracts';

type Stage = 'idle' | 'compressing' | 'analyzing' | 'searching' | 'results' | 'error';

interface Props {
  onChoose?: (candidate: CoverScanCandidate) => void;
  onClose?: () => void;
}

export function CoverPhotoScanner({ onChoose, onClose }: Props) {
  const t = useTranslations('scanCapa');
  const [stage, setStage] = useState<Stage>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CoverScanCandidate[]>([]);
  const [identified, setIdentified] = useState<CoverScanIdentified | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [scanLogId, setScanLogId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedAtRef = useRef<number>(0);

  async function handleFile(file: File) {
    setStage('compressing');
    setPreviewUrl(URL.createObjectURL(file));
    startedAtRef.current = Date.now();

    try {
      const dataUri = await compressImageToDataUri(file);
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
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        setErrorMsg(t('rateLimitMessage'));
      } else if (status && status >= 500) {
        setErrorMsg(t('errorServer'));
      } else {
        const msg = err instanceof Error ? err.message : 'unknown';
        setErrorMsg(msg);
      }
      setStage('error');
    }
  }

  async function handleChoose(candidate: CoverScanCandidate | null) {
    if (!candidate) {
      if (scanLogId) {
        await recordChoice({ scanLogId, chosenEntryId: null }).catch(() => {});
      }
      return;
    }

    // Externo: importar primeiro (cria entry PENDING + adiciona a colecao)
    if (candidate.isExternal && candidate.externalSource && candidate.externalRef && scanLogId) {
      try {
        const importResult = await importExternal({
          scanLogId,
          externalSource: candidate.externalSource,
          externalRef: candidate.externalRef,
        });
        // Repassar pro onChoose com o id real da entry recem-criada
        onChoose?.({
          ...candidate,
          id: importResult.catalogEntryId,
          isExternal: false,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('errorGeneric');
        setErrorMsg(msg);
        setStage('error');
      }
      return;
    }

    // Interno: fluxo existente
    if (scanLogId) {
      await recordChoice({ scanLogId, chosenEntryId: candidate.id }).catch(() => {});
    }
    onChoose?.(candidate);
  }

  function reset() {
    setStage('idle');
    setPreviewUrl(null);
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
        <div className="flex flex-col items-center gap-3">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={t('preview')}
              width={200}
              height={300}
              className="rounded border object-contain"
            />
          )}
          <p className="text-sm text-muted-foreground">
            {stage === 'compressing'
              ? t('compressing')
              : stage === 'analyzing'
                ? t('analyzing')
                : t('searching')}
          </p>
        </div>
      )}

      {stage === 'results' && (
        <div className="space-y-3">
          {(previewUrl || (identified && identified.title)) && (
            <div className="flex items-stretch gap-3 rounded border border-primary/30 bg-primary/5 p-3 text-sm">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
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
                    onClick={() => handleChoose(c)}
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
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" onClick={() => handleChoose(null)} className="w-full">
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
    </div>
  );
}
