'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ContactSuccessProps {
  onReset: () => void;
}

export function ContactSuccess({ onReset }: ContactSuccessProps) {
  const locale = useLocale();

  return (
    <Card className="max-w-lg mx-auto">
      <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
        </div>

        <h2 className="text-xl font-bold">Mensagem enviada com sucesso!</h2>

        <p className="text-muted-foreground">Responderemos em ate 48 horas uteis.</p>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={onReset} variant="outline">
            Enviar outra mensagem
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href={`/${locale}`}>Voltar ao inicio</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
