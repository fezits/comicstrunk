'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth/use-auth';
import { deleteMyAccount } from '@/lib/api/lgpd';

const CONSEQUENCES = [
  'Seus dados pessoais serao removidos apos 30 dias',
  'Pedidos e transacoes financeiras serao mantidos (obrigacao fiscal)',
  'Sua colecao e favoritos serao excluidos permanentemente',
  'Avaliacoes e comentarios serao anonimizados',
  'Assinatura ativa sera cancelada',
];

export function AccountDeletionFlow() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [emailConfirm, setEmailConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const emailMatch = emailConfirm.trim().toLowerCase() === user?.email?.toLowerCase();

  const handleDelete = async () => {
    if (!emailMatch) return;
    setLoading(true);
    try {
      await deleteMyAccount();
      toast.success('Solicitacao de exclusao enviada. Sua conta sera removida em 30 dias.');
      setOpen(false);
      await logout();
      router.push(`/${locale}`);
    } catch {
      toast.error('Erro ao solicitar exclusao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setStep(1);
      setEmailConfirm('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir Conta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Excluir Conta Permanentemente
              </DialogTitle>
              <DialogDescription>
                Esta acao e irreversivel. Leia atentamente as consequencias antes de continuar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <p className="text-sm font-medium text-foreground">
                Ao excluir sua conta:
              </p>
              <ul className="space-y-2">
                {CONSEQUENCES.map((consequence, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                    {consequence}
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Entendo, quero continuar
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="text-destructive">Confirmar exclusao</DialogTitle>
              <DialogDescription>
                Para confirmar, digite seu email:{' '}
                <span className="font-mono font-semibold text-foreground">{user?.email}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <Label htmlFor="email-confirm" className="text-sm">
                Seu email
              </Label>
              <Input
                id="email-confirm"
                type="email"
                placeholder="Digite seu email para confirmar"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                autoComplete="off"
              />
              {emailConfirm.length > 0 && !emailMatch && (
                <p className="text-xs text-destructive">O email nao confere.</p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                disabled={!emailMatch || loading}
                onClick={handleDelete}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir Minha Conta Permanentemente
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
