'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check, QrCode } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PixQrCodeProps {
  qrCodeBase64: string | null;
  copyPasteCode: string | null;
}

export function PixQrCode({ qrCodeBase64, copyPasteCode }: PixQrCodeProps) {
  const t = useTranslations('payments');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyPasteCode) return;

    try {
      await navigator.clipboard.writeText(copyPasteCode);
      setCopied(true);
      toast.success(t('codeCopied'));
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = copyPasteCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success(t('codeCopied'));
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <Card className="border-border/50">
      <CardContent className="flex flex-col items-center gap-6 pt-6">
        {/* QR Code Image */}
        {qrCodeBase64 ? (
          <div className="rounded-xl bg-white p-4">
            <img
              src={`data:image/png;base64,${qrCodeBase64}`}
              alt="PIX QR Code"
              className="h-52 w-52"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-8">
            <QrCode className="h-16 w-16 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('qrUnavailable')}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">{t('scanQrCode')}</p>
          <p className="text-xs text-muted-foreground">{t('orCopyCode')}</p>
        </div>

        {/* Copia-e-cola section */}
        {copyPasteCode ? (
          <div className="w-full space-y-3">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
              <p className="break-all text-xs font-mono text-muted-foreground leading-relaxed">
                {copyPasteCode}
              </p>
            </div>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="w-full gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  {t('codeCopied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t('copyCode')}
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('copyPasteUnavailable')}</p>
        )}
      </CardContent>
    </Card>
  );
}
