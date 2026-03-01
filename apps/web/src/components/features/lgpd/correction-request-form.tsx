'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createDataRequest } from '@/lib/api/lgpd';

interface CorrectionRequestFormProps {
  onSuccess?: () => void;
}

export function CorrectionRequestForm({ onSuccess }: CorrectionRequestFormProps) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!details.trim()) return;
    setLoading(true);
    try {
      await createDataRequest({ type: 'CORRECTION', details: details.trim() });
      toast.success('Solicitacao de correcao enviada com sucesso.');
      setOpen(false);
      setDetails('');
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data
              ?.error?.message
          : undefined;
      toast.error(message ?? 'Erro ao enviar solicitacao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setDetails(''); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Solicitar Correcao
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Correcao de Dados</DialogTitle>
          <DialogDescription>
            Descreva quais dados precisam ser corrigidos e qual a informacao correta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Label htmlFor="correction-details">Detalhes da correcao</Label>
          <Textarea
            id="correction-details"
            placeholder="Descreva quais dados precisam ser corrigidos"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            maxLength={5000}
          />
          <p className="text-xs text-muted-foreground text-right">
            {details.length}/5000 caracteres
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!details.trim() || loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Solicitacao
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
