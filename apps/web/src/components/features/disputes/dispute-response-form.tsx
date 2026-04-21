'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { respondToDispute } from '@/lib/api/disputes';

interface DisputeResponseFormProps {
  disputeId: string;
  onSuccess: () => void;
}

export function DisputeResponseForm({ disputeId, onSuccess }: DisputeResponseFormProps) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim().length < 10) {
      toast.error('A resposta deve ter pelo menos 10 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await respondToDispute(disputeId, { message: message.trim() });
      toast.success('Resposta enviada com sucesso!');
      setMessage('');
      onSuccess();
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? 'Erro ao enviar resposta. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-amber-500/30">
      <CardHeader>
        <CardTitle className="text-base">Responder Disputa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Apresente sua versao dos fatos. Apos sua resposta, a disputa sera encaminhada
          para mediacao.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="response-message">Sua resposta *</Label>
            <Textarea
              id="response-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explique sua posicao sobre a disputa..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Minimo 10 caracteres.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Enviando...' : 'Enviar Resposta'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
