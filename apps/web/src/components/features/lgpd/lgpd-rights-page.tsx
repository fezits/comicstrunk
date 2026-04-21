'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Edit,
  FileDown,
  Trash2,
  Inbox,
  Shield,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataExportSection } from './data-export-section';
import { AccountDeletionFlow } from './account-deletion-flow';
import { CorrectionRequestForm } from './correction-request-form';
import {
  listMyRequests,
  type DataRequest,
  type DataRequestStatus,
  type DataRequestType,
} from '@/lib/api/lgpd';

// === Status Helpers ===

const STATUS_LABELS: Record<DataRequestStatus, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Em Processamento',
  COMPLETED: 'Concluida',
  REJECTED: 'Rejeitada',
};

const STATUS_VARIANTS: Record<DataRequestStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'outline',
  PROCESSING: 'secondary',
  COMPLETED: 'default',
  REJECTED: 'destructive',
};

const TYPE_LABELS: Record<DataRequestType, string> = {
  ACCESS: 'Acesso',
  CORRECTION: 'Correcao',
  DELETION: 'Exclusao',
  EXPORT: 'Exportacao',
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

// === Rights Cards Config ===

interface RightsCard {
  id: string;
  title: string;
  description: string;
  icon: typeof Download;
  iconColor?: string;
  destructive?: boolean;
}

const RIGHTS_CARDS: RightsCard[] = [
  {
    id: 'access',
    title: 'Acessar Dados',
    description: 'Baixe uma copia dos seus dados pessoais',
    icon: Download,
  },
  {
    id: 'correction',
    title: 'Corrigir Dados',
    description: 'Solicite correcao de dados incorretos',
    icon: Edit,
  },
  {
    id: 'portability',
    title: 'Portabilidade',
    description: 'Exporte seus dados em formato JSON',
    icon: FileDown,
  },
  {
    id: 'deletion',
    title: 'Excluir Conta',
    description: 'Solicite a exclusao permanente da sua conta',
    icon: Trash2,
    iconColor: 'text-destructive',
    destructive: true,
  },
];

// === Main Component ===

export function LgpdRightsPage() {
  const [requests, setRequests] = useState<DataRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMyRequests({ page: 1, limit: 50 });
      setRequests(result.data);
    } catch {
      // Silently fail — user may have no requests
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seus Direitos (LGPD)</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus dados pessoais conforme a Lei Geral de Protecao de Dados
          </p>
        </div>
      </div>

      {/* Rights Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {RIGHTS_CARDS.map((card) => (
          <Card key={card.id} className={card.destructive ? 'border-destructive/30' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    card.destructive
                      ? 'bg-destructive/10'
                      : 'bg-primary/10'
                  }`}
                >
                  <card.icon
                    className={`h-5 w-5 ${card.iconColor ?? 'text-primary'}`}
                  />
                </div>
                <div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription className="text-xs">{card.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {card.id === 'access' && <DataExportSection />}
              {card.id === 'correction' && (
                <CorrectionRequestForm onSuccess={fetchRequests} />
              )}
              {card.id === 'portability' && <DataExportSection />}
              {card.id === 'deletion' && <AccountDeletionFlow />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request History */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Historico de Solicitacoes</h2>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Nenhuma solicitacao de dados encontrada
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header (desktop) */}
            <div className="hidden sm:grid grid-cols-4 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Tipo</span>
              <span>Status</span>
              <span>Data</span>
              <span>Detalhes</span>
            </div>

            {requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                    <div className="flex items-center justify-between sm:block">
                      <span className="text-sm font-medium">
                        {TYPE_LABELS[request.type]}
                      </span>
                      <div className="sm:hidden">
                        <Badge variant={STATUS_VARIANTS[request.status]}>
                          {STATUS_LABELS[request.status]}
                        </Badge>
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <Badge variant={STATUS_VARIANTS[request.status]}>
                        {STATUS_LABELS[request.status]}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </span>
                    <span className="text-sm text-muted-foreground line-clamp-1">
                      {request.details ?? '-'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
