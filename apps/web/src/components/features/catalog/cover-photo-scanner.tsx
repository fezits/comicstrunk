'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { searchByText, recordChoice } from '@/lib/api/cover-scan';
import type {
  CoverScanCandidate,
  CoverScanSearchInput,
} from '@comicstrunk/contracts';

type Stage = 'idle' | 'reading' | 'searching' | 'results' | 'error';

interface Props {
  onChoose?: (candidate: CoverScanCandidate) => void;
  onClose?: () => void;
}

function extractCandidateNumber(text: string): number | undefined {
  const match = text.match(/(?:#|n[oº]\.?\s*|edi[çc][aã]o\s*)?(\d{1,4})\b/i);
  if (!match) return undefined;
  const n = parseInt(match[1], 10);
  return n > 0 && n < 10000 ? n : undefined;
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s\n\r\t.,!?;:()[\]{}'"]+/)
    .filter((t) => t.length >= 3 && t.length <= 50)
    .slice(0, 50);
}

export function CoverPhotoScanner({ onChoose, onClose }: Props) {
  const t = useTranslations('scanCapa');
  const [stage, setStage] = useState<Stage>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CoverScanCandidate[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [scanLogId, setScanLogId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const startedAtRef = useRef<number>(0);

  async function handleFile(file: File) {
    setStage('reading');
    setPreviewUrl(URL.createObjectURL(file));
    startedAtRef.current = Date.now();

    try {
      // Lazy import — só baixa o Tesseract no clique do usuário
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['por', 'eng'], 1, {
        logger: () => {}, // silencia console
      });

      const { data } = await worker.recognize(file);
      const rawText = data.text || '';
      await worker.terminate();

      const tokens = tokenize(rawText);
      if (tokens.length === 0) {
        setErrorMsg(t('errorNoText'));
        setStage('error');
        return;
      }

      setStage('searching');
      const candidateNumber = extractCandidateNumber(rawText);
      const input: CoverScanSearchInput = {
        rawText: rawText.slice(0, 5000),
        ocrTokens: tokens,
        ...(candidateNumber !== undefined && { candidateNumber }),
        durationMs: Date.now() - startedAtRef.current,
      };

      const result = await searchByText(input);
      setCandidates(result.candidates);
      setScanLogId(result.scanLogId);
      setStage('results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setErrorMsg(msg);
      setStage('error');
    }
  }

  async function handleChoose(candidate: CoverScanCandidate | null) {
    if (scanLogId) {
      try {
        await recordChoice({ scanLogId, chosenEntryId: candidate?.id ?? null });
      } catch {
        // não bloqueia o fluxo se falhar — choice é só telemetria
      }
    }
    if (candidate) {
      onChoose?.(candidate);
    }
  }

  function reset() {
    setStage('idle');
    setPreviewUrl(null);
    setCandidates([]);
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
          <Button onClick={() => fileInputRef.current?.click()}>
            {t('chooseFile')}
          </Button>
        </div>
      )}

      {(stage === 'reading' || stage === 'searching') && (
        <div className="flex flex-col items-center gap-3">
          {previewUrl && (
            <Image
              src={previewUrl}
              alt={t('preview')}
              width={200}
              height={300}
              className="rounded border object-contain"
              unoptimized
            />
          )}
          <p className="text-sm text-muted-foreground">
            {stage === 'reading' ? t('reading') : t('searching')}
          </p>
        </div>
      )}

      {stage === 'results' && (
        <div className="space-y-3">
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
                    className="block w-full rounded border bg-card p-2 text-left hover:border-primary"
                  >
                    {c.coverImageUrl && (
                      <Image
                        src={c.coverImageUrl}
                        alt={c.title}
                        width={150}
                        height={220}
                        className="aspect-[2/3] w-full rounded object-cover"
                        unoptimized
                      />
                    )}
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

      {onClose && stage !== 'reading' && stage !== 'searching' && (
        <Button variant="ghost" onClick={onClose} className="w-full">
          {t('close')}
        </Button>
      )}
    </div>
  );
}
