'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateTracking } from '@/lib/api/shipping';

const CARRIERS = [
  { value: 'Correios PAC', labelKey: 'carriers.correiosPac' },
  { value: 'Correios SEDEX', labelKey: 'carriers.correiosSedex' },
  { value: 'Jadlog', labelKey: 'carriers.jadlog' },
  { value: 'Total Express', labelKey: 'carriers.totalExpress' },
  { value: 'Loggi', labelKey: 'carriers.loggi' },
  { value: 'Outro', labelKey: 'carriers.other' },
];

interface TrackingFormProps {
  orderItemId: string;
  onTrackingUpdated: () => void;
}

export function TrackingForm({ orderItemId, onTrackingUpdated }: TrackingFormProps) {
  const t = useTranslations('seller');

  const [trackingCode, setTrackingCode] = useState('');
  const [carrier, setCarrier] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isValid = trackingCode.trim().length > 0 && carrier.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setSubmitting(true);
    try {
      await updateTracking(orderItemId, {
        trackingCode: trackingCode.trim(),
        carrier,
      });
      toast.success(t('trackingUpdated'));
      onTrackingUpdated();
    } catch {
      toast.error(t('trackingError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
      <p className="text-sm font-medium text-primary">{t('enterTracking')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('trackingCode')}</Label>
          <Input
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            placeholder="AA123456789BR"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t('carrier')}</Label>
          <Select value={carrier} onValueChange={setCarrier}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={t('carrier')} />
            </SelectTrigger>
            <SelectContent>
              {CARRIERS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {t(c.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        type="submit"
        size="sm"
        disabled={!isValid || submitting}
        className="gap-1.5"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {t('submitTracking')}
      </Button>
    </form>
  );
}
