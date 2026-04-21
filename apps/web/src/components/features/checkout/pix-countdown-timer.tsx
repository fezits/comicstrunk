'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PixCountdownTimerProps {
  expiresAt: string | null;
  onExpired: () => void;
}

function calculateRemainingSeconds(expiresAt: string): number {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  return Math.max(0, Math.floor((expiry - now) / 1000));
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function PixCountdownTimer({ expiresAt, onExpired }: PixCountdownTimerProps) {
  const t = useTranslations('payments');
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const [remaining, setRemaining] = useState<number>(() =>
    expiresAt ? calculateRemainingSeconds(expiresAt) : -1,
  );

  const isExpired = remaining === 0;

  const handleExpired = useCallback(() => {
    onExpiredRef.current();
  }, []);

  useEffect(() => {
    if (!expiresAt) return;

    const initialRemaining = calculateRemainingSeconds(expiresAt);
    setRemaining(initialRemaining);

    if (initialRemaining <= 0) {
      handleExpired();
      return;
    }

    const interval = setInterval(() => {
      const next = calculateRemainingSeconds(expiresAt);
      setRemaining(next);

      if (next <= 0) {
        clearInterval(interval);
        handleExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, handleExpired]);

  // No expiry set
  if (!expiresAt || remaining < 0) {
    return (
      <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs">{t('noTimeLimit')}</span>
      </Badge>
    );
  }

  // Expired
  if (isExpired) {
    return (
      <Badge variant="destructive" className="gap-1.5 px-3 py-1.5">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs">{t('timeExpired')}</span>
      </Badge>
    );
  }

  // Color coding: green > 5min, yellow 1-5min, red < 1min
  const isWarning = remaining <= 300 && remaining > 60; // 1-5 min
  const isCritical = remaining <= 60; // < 1 min

  const colorClass = isCritical
    ? 'border-red-500/50 bg-red-500/10 text-red-500 dark:border-red-400/50 dark:bg-red-400/10 dark:text-red-400'
    : isWarning
      ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:border-yellow-400/50 dark:bg-yellow-400/10 dark:text-yellow-400'
      : 'border-green-500/50 bg-green-500/10 text-green-600 dark:border-green-400/50 dark:bg-green-400/10 dark:text-green-400';

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 ${colorClass}`}>
      <Clock className={`h-3.5 w-3.5 ${isCritical ? 'animate-pulse' : ''}`} />
      <span className="text-xs font-medium">{t('timeRemaining')}</span>
      <span className="text-sm font-bold tabular-nums">{formatTime(remaining)}</span>
    </div>
  );
}
