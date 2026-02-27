'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CartCountdownState {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  remaining: number;
}

function calculateRemaining(expiresAt: string): CartCountdownState {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const remaining = Math.max(0, expiry - now);
  const isExpired = remaining <= 0;

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, isExpired, remaining };
}

export function useCartCountdown(expiresAt: string): CartCountdownState {
  const [state, setState] = useState(() => calculateRemaining(expiresAt));

  useEffect(() => {
    setState(calculateRemaining(expiresAt));

    const interval = setInterval(() => {
      const next = calculateRemaining(expiresAt);
      setState(next);
      if (next.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return state;
}

interface CartCountdownProps {
  expiresAt: string;
}

export function CartCountdown({ expiresAt }: CartCountdownProps) {
  const t = useTranslations('cart');
  const { hours, minutes, seconds, isExpired, remaining } = useCartCountdown(expiresAt);

  const isWarning = !isExpired && remaining < 3600000; // < 1 hour

  const displayText = useMemo(() => {
    if (isExpired) return t('reservationExpired');

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${String(minutes).padStart(2, '0')}m`);
    parts.push(`${String(seconds).padStart(2, '0')}s`);
    return parts.join(' ');
  }, [isExpired, hours, minutes, seconds, t]);

  if (isExpired) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
        <Clock className="h-3 w-3" />
        {displayText}
      </span>
    );
  }

  return (
    <span
      className={`flex items-center gap-1 text-xs font-medium ${
        isWarning ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'
      }`}
    >
      <Clock className="h-3 w-3" />
      {displayText}
    </span>
  );
}
