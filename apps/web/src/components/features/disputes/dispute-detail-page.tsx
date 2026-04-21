'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  ImagePlus,
  Upload,
  Send,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import { DisputeStatusBadge } from './dispute-status-badge';
import { DisputeReasonBadge } from './dispute-reason-badge';
import { DisputeTimeline } from './dispute-timeline';
import { DisputeMessageThread } from './dispute-message-thread';
import { DisputeResponseForm } from './dispute-response-form';
import { EvidenceGallery } from './evidence-gallery';
import {
  getDispute,
  cancelDispute,
  addEvidence,
  addDisputeMessage,
  type Dispute,
} from '@/lib/api/disputes';
import { useAuth } from '@/lib/auth/use-auth';

function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

interface DisputeDetailPageProps {
  disputeId: string;
  backUrl?: string;
}

export function DisputeDetailPage({ disputeId, backUrl }: DisputeDetailPageProps) {
  const locale = useLocale();
  const { user } = useAuth();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Add evidence dialog
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add message
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const defaultBackUrl = backUrl ?? `/${locale}/disputes`;

  const fetchDispute = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getDispute(disputeId);
      setDispute(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  // Determine user role in this dispute
  const isBuyer = dispute?.buyerId === user?.id;
  const isSeller = dispute?.sellerId === user?.id;

  const isOpen = dispute?.status === 'OPEN';
  const isActive =
    dispute?.status === 'OPEN' || dispute?.status === 'IN_MEDIATION';

  // Handlers
  const handleCancel = async () => {
    if (!dispute) return;
    setCancelling(true);
    try {
      const updated = await cancelDispute(dispute.id);
      setDispute(updated);
      setCancelDialogOpen(false);
      toast.success('Disputa cancelada com sucesso.');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? 'Erro ao cancelar disputa.';
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  const handleAddEvidence = async () => {
    if (!dispute || !evidenceFile) return;
    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('image', evidenceFile);
      if (evidenceDescription.trim()) {
        formData.append('description', evidenceDescription.trim());
      }
      await addEvidence(dispute.id, formData);
      toast.success('Evidencia adicionada com sucesso!');
      setEvidenceDialogOpen(false);
      setEvidenceFile(null);
      setEvidenceDescription('');
      fetchDispute();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? 'Erro ao enviar evidencia.';
      toast.error(message);
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleSendMessage = async () => {
    if (!dispute || newMessage.trim().length < 1) return;
    setSendingMessage(true);
    try {
      await addDisputeMessage(dispute.id, { message: newMessage.trim() });
      setNewMessage('');
      fetchDispute();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? 'Erro ao enviar mensagem.';
      toast.error(message);
    } finally {
      setSendingMessage(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  // Not found state
  if (notFound || !dispute) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 space-y-4">
        <MessageSquare className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-2xl font-bold">Disputa nao encontrada</h2>
        <p className="text-muted-foreground">
          A disputa que voce procura nao existe ou voce nao tem acesso.
        </p>
        <Button asChild variant="outline">
          <Link href={defaultBackUrl}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </div>
    );
  }

  // Separate buyer and seller evidence
  const buyerEvidence = dispute.evidence.filter(
    (e) => e.submittedBy.id === dispute.buyerId,
  );
  const sellerEvidence = dispute.evidence.filter(
    (e) => e.submittedBy.id === dispute.sellerId,
  );

  const itemTitle =
    dispute.orderItem.collectionItem?.catalogEntry?.title ??
    `Item #${dispute.orderItemId.slice(0, 8)}`;
  const itemCover =
    dispute.orderItem.collectionItem?.catalogEntry?.coverImageUrl;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={defaultBackUrl}
          className="hover:text-foreground transition-colors"
        >
          Disputas
        </Link>
        <span>/</span>
        <span className="text-foreground">#{dispute.id.slice(0, 8)}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Disputa #{dispute.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aberta em {formatDate(dispute.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DisputeStatusBadge status={dispute.status} />
          <DisputeReasonBadge reason={dispute.reason} />
        </div>
      </div>

      {/* Order & Item Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informacoes do Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            {/* Item thumbnail */}
            <div className="w-16 aspect-[2/3] rounded overflow-hidden bg-muted shrink-0">
              {itemCover ? (
                <img
                  src={itemCover}
                  alt={itemTitle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                </div>
              )}
            </div>

            {/* Item details */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-medium line-clamp-2">{itemTitle}</p>
              <p className="text-sm text-muted-foreground">
                Pedido #{dispute.order.orderNumber}
              </p>
              <p className="text-lg font-bold text-primary">
                {formatPrice(dispute.orderItem.priceSnapshot)}
              </p>
            </div>
          </div>

          {/* Description */}
          <Separator className="my-4" />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Descricao do problema</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {dispute.description}
            </p>
          </div>

          {/* Resolution info */}
          {dispute.resolution && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Resolucao</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {dispute.resolution}
                </p>
                {dispute.refundAmount && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Valor reembolsado: {formatPrice(dispute.refundAmount)}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <DisputeTimeline dispute={dispute} />
        </CardContent>
      </Card>

      {/* Evidence - Buyer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evidencias do Comprador</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceGallery evidence={buyerEvidence} />
        </CardContent>
      </Card>

      {/* Evidence - Seller */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evidencias do Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceGallery evidence={sellerEvidence} />
        </CardContent>
      </Card>

      {/* Seller Response Form (only for seller when dispute is OPEN) */}
      {isSeller && isOpen && (
        <DisputeResponseForm
          disputeId={dispute.id}
          onSuccess={fetchDispute}
        />
      )}

      {/* Message Thread */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DisputeMessageThread
            messages={dispute.messages}
            buyerId={dispute.buyerId}
            sellerId={dispute.sellerId}
          />

          {/* New message form (if dispute is active) */}
          {isActive && (
            <>
              <Separator />
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  rows={2}
                  className="resize-none flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={sendingMessage || newMessage.trim().length < 1}
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      {isActive && (
        <div className="flex items-center justify-between gap-3">
          {/* Add evidence button */}
          <Button
            variant="outline"
            onClick={() => setEvidenceDialogOpen(true)}
          >
            <ImagePlus className="h-4 w-4 mr-2" />
            Adicionar Evidencia
          </Button>

          {/* Cancel dispute button (buyer only, OPEN status only) */}
          {isBuyer && isOpen && (
            <Button
              variant="destructive"
              onClick={() => setCancelDialogOpen(true)}
            >
              Cancelar Disputa
            </Button>
          )}
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Disputa</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja cancelar esta disputa? O status do item do pedido
              sera restaurado.
            </p>
            <p className="text-sm text-destructive">
              Esta acao nao pode ser desfeita.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add evidence dialog */}
      <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Evidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* File input */}
            <div className="space-y-2">
              <Label>Imagem *</Label>
              {evidenceFile ? (
                <div className="relative">
                  <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                    <img
                      src={URL.createObjectURL(evidenceFile)}
                      alt="Preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEvidenceFile(null)}
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEvidenceFile(file);
                    }}
                    className="hidden"
                    id="evidence-single-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Clique para selecionar uma imagem
                      </span>
                    </div>
                  </Button>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="evidence-desc">Descricao (opcional)</Label>
              <Input
                id="evidence-desc"
                value={evidenceDescription}
                onChange={(e) => setEvidenceDescription(e.target.value)}
                placeholder="Descreva a evidencia..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEvidenceDialogOpen(false);
                setEvidenceFile(null);
                setEvidenceDescription('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddEvidence}
              disabled={!evidenceFile || uploadingEvidence}
            >
              {uploadingEvidence ? 'Enviando...' : 'Enviar Evidencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
