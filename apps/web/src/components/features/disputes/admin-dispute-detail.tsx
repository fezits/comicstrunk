'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  Send,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

import { DisputeStatusBadge } from './dispute-status-badge';
import { DisputeReasonBadge } from './dispute-reason-badge';
import { DisputeTimeline } from './dispute-timeline';
import { DisputeMessageThread } from './dispute-message-thread';
import { EvidenceGallery } from './evidence-gallery';
import { AdminResolutionForm } from './admin-resolution-form';
import {
  getDispute,
  addDisputeMessage,
  type Dispute,
} from '@/lib/api/disputes';

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

interface AdminDisputeDetailProps {
  disputeId: string;
}

export function AdminDisputeDetail({ disputeId }: AdminDisputeDetailProps) {
  const locale = useLocale();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Admin message
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchDispute = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getDispute(disputeId);
      setDispute(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404 || status === 403) setNotFound(true);
      else toast.error('Erro ao carregar disputa');
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  const handleSendMessage = async () => {
    if (!dispute || newMessage.trim().length < 1) return;
    setSendingMessage(true);
    try {
      await addDisputeMessage(dispute.id, { message: newMessage.trim() });
      setNewMessage('');
      fetchDispute();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Erro ao enviar mensagem.';
      toast.error(message);
    } finally {
      setSendingMessage(false);
    }
  };

  const isActive =
    dispute?.status === 'OPEN' || dispute?.status === 'IN_MEDIATION';

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  // Not found state
  if (notFound || !dispute) {
    return (
      <div className="text-center py-16 space-y-4">
        <MessageSquare className="h-16 w-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-2xl font-bold">Disputa nao encontrada</h2>
        <p className="text-muted-foreground">
          A disputa que voce procura nao existe ou voce nao tem acesso.
        </p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/admin/disputes`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar as disputas
          </Link>
        </Button>
      </div>
    );
  }

  // Separate evidence by party
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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/${locale}/admin/disputes`}
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

      {/* Evidence comparison - two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evidencias do Comprador</CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenceGallery evidence={buyerEvidence} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evidencias do Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenceGallery evidence={sellerEvidence} />
          </CardContent>
        </Card>
      </div>

      {/* Order details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhes do Pedido</CardTitle>
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

            {/* Item info */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-medium line-clamp-2">{itemTitle}</p>
              <p className="text-sm text-muted-foreground">
                Pedido{' '}
                <Link
                  href={`/${locale}/orders/${dispute.orderId}`}
                  className="text-primary hover:underline"
                >
                  #{dispute.order.orderNumber}
                </Link>
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

          {/* Resolution info (if resolved) */}
          {dispute.resolution && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Resolucao</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {dispute.resolution}
                </p>
                {dispute.refundAmount != null && dispute.refundAmount > 0 && (
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Valor reembolsado: {formatPrice(dispute.refundAmount)}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Buyer / Seller info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Comprador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">{dispute.buyer.name}</p>
            <p className="text-xs text-muted-foreground">
              ID: {dispute.buyer.id.slice(0, 12)}...
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">{dispute.seller.name}</p>
            <p className="text-xs text-muted-foreground">
              ID: {dispute.seller.id.slice(0, 12)}...
            </p>
          </CardContent>
        </Card>
      </div>

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

          {/* Admin message form (if dispute is active) */}
          {isActive && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Enviar mensagem como administrador
                </p>
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escreva uma mensagem para as partes..."
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

      {/* Resolution form (only if active) */}
      {isActive && (
        <AdminResolutionForm
          disputeId={dispute.id}
          maxRefundAmount={dispute.orderItem.priceSnapshot}
          onResolved={fetchDispute}
        />
      )}
    </div>
  );
}
