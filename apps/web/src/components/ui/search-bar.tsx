'use client';

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  minCharsForAutoSubmit?: number;
  debounceMs?: number;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  className,
  inputClassName,
  minCharsForAutoSubmit = 3,
  debounceMs = 400,
  autoFocus = false,
}: SearchBarProps) {
  const t = useTranslations('common');
  const isMobile = useIsMobile();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmittedRef = useRef<string | null>(null);

  const fireSubmit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === lastSubmittedRef.current) return;
    lastSubmittedRef.current = trimmed;
    onSubmit(trimmed);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (next: string) => {
    onChange(next);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isMobile) return;
    const trimmed = next.trim();
    if (trimmed.length === 0 || trimmed.length >= minCharsForAutoSubmit) {
      timerRef.current = setTimeout(() => fireSubmit(next), debounceMs);
    }
  };

  const handleManualSubmit = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    fireSubmit(value);
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleManualSubmit();
          }
        }}
        autoFocus={autoFocus}
        className={cn(
          'h-10 pl-9 pr-10 focus-visible:ring-2 focus-visible:ring-primary',
          inputClassName,
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('search')}
        onClick={handleManualSubmit}
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 md:hidden"
      >
        <Search className="h-4 w-4" />
      </Button>
    </div>
  );
}
