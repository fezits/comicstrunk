'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { resolveDispute } from '@/lib/api/disputes';

type ResolutionType =
  | 'RESOLVED_REFUND'
  | 'RESOLVED_PARTIAL_REFUND'
  | 'RESOLVED_NO_REFUND';

interface AdminResolutionFormProps {
  disputeId: string;
  maxRefundAmount: number;
  onResolved: () => void;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function AdminResolutionForm({
  disputeId,
  maxRefundAmount,
  onResolved,
}: AdminResolutionFormProps) {
  const [resolutionType, setResolutionType] =
    useState<ResolutionType>('RESOLVED_REFUND');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isPartialRefund = resolutionType === 'RESOLVED_PARTIAL_REFUND';
  const justificationValid = justification.trim().length >= 10;

  const partialAmountNum = parseFloat(refundAmount);
  const partialAmountValid =
    !isPartialRefund ||
    (!isNaN(partialAmountNum) &&
      partialAmountNum > 0 &&
      partialAmountNum <= maxRefundAmount);

  const formValid = justificationValid && partialAmountValid;

  const handleSubmitClick = () => {
    if (!formValid) return;
    setShowConfirm(true);
  };

  const handleConfirmResolve = async () => {
    setSubmitting(true);
    try {
      const payload: {
        status: string;
        resolution: string;
        refundAmount?: number;
      } = {
        status: resolutionType,
        resolution: justification.trim(),
      };

      if (isPartialRefund) {
        payload.refundAmount = partialAmountNum;
      }

      await resolveDispute(disputeId, payload);
      toast.success('Disputa resolvida com sucesso!');
      setShowConfirm(false);
      onResolved();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Erro ao resolver disputa.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resolutionOptions: {
    value: ResolutionType;
    label: string;
    description: string;
  }[] = [
    {
      value: 'RESOLVED_REFUND',
      label: 'Reembolso total',
      description: `Comprador recebe ${formatBRL(maxRefundAmount)} de volta`,
    },
    {
      value: 'RESOLVED_PARTIAL_REFUND',
      label: 'Reembolso parcial',
      description: 'Defina o valor abaixo',
    },
    {
      value: 'RESOLVED_NO_REFUND',
      label: 'Sem reembolso',
      description: 'Disputa resolvida a favor do vendedor',
    },
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resolver Disputa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resolution type radio group */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de resolucao</Label>
            <div className="space-y-2">
              {resolutionOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    resolutionType === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="resolutionType"
                    value={option.value}
                    checked={resolutionType === option.value}
                    onChange={(e) =>
                      setResolutionType(e.target.value as ResolutionType)
                    }
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Partial refund amount input */}
          {isPartialRefund && (
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Valor do reembolso (R$)</Label>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={maxRefundAmount}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`Maximo: ${formatBRL(maxRefundAmount)}`}
              />
              {refundAmount && !partialAmountValid && (
                <p className="text-xs text-destructive">
                  Valor deve ser entre R$ 0,01 e {formatBRL(maxRefundAmount)}
                </p>
              )}
            </div>
          )}

          {/* Justification */}
          <div className="space-y-2">
            <Label htmlFor="justification">
              Justificativa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Descreva a justificativa para esta resolucao (minimo 10 caracteres)..."
              rows={4}
              className="resize-none"
            />
            {justification.length > 0 && !justificationValid && (
              <p className="text-xs text-destructive">
                Justificativa deve ter no minimo 10 caracteres (
                {justification.trim().length}/10)
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmitClick}
            disabled={!formValid || submitting}
            className="w-full bg-primary hover:bg-primary/90"
          >
            Resolver Disputa
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Resolucao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja resolver esta disputa? Esta acao nao pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmResolve}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90"
            >
              {submitting ? 'Processando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
