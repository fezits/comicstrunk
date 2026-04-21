'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Upload, X, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createDispute, type DisputeReason } from '@/lib/api/disputes';

const REASON_OPTIONS: Array<{ value: DisputeReason; label: string }> = [
  { value: 'NOT_RECEIVED', label: 'Nao recebido' },
  { value: 'DIFFERENT_FROM_LISTING', label: 'Diferente do anuncio' },
  { value: 'DAMAGED_IN_TRANSIT', label: 'Danificado no transporte' },
  { value: 'NOT_SHIPPED_ON_TIME', label: 'Nao enviado no prazo' },
];

interface CreateDisputeFormProps {
  orderItemId: string;
}

export function CreateDisputeForm({ orderItemId }: CreateDisputeFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reason, setReason] = useState<DisputeReason | ''>('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    const totalFiles = files.length + newFiles.length;

    if (totalFiles > 5) {
      toast.error('Maximo de 5 imagens permitido.');
      return;
    }

    setFiles((prev) => [...prev, ...newFiles]);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason) {
      setError('Selecione um motivo para a disputa.');
      return;
    }

    if (description.trim().length < 10) {
      setError('A descricao deve ter pelo menos 10 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const dispute = await createDispute({
        orderItemId,
        reason: reason as DisputeReason,
        description: description.trim(),
      });

      toast.success('Disputa aberta com sucesso!');
      router.push(`/${locale}/disputes/${dispute.id}`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? 'Erro ao abrir disputa. Tente novamente.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Abrir Disputa
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados abaixo para abrir uma disputa sobre o item do pedido.
            O vendedor tera 48 horas para responder.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da disputa *</Label>
              <Select
                value={reason}
                onValueChange={(value) => setReason(value as DisputeReason)}
              >
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descricao detalhada *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o problema com detalhes. Quanto mais informacoes, melhor sera a analise."
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Minimo 10 caracteres. Seja claro e objetivo.
              </p>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Evidencias (opcional, max. 5 imagens)</Label>
              <div className="space-y-3">
                {/* File previews */}
                {files.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-lg overflow-hidden bg-muted border group"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Evidencia ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button */}
                {files.length < 5 && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="evidence-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Adicionar imagem ({files.length}/5)
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Abrindo disputa...' : 'Abrir Disputa'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
