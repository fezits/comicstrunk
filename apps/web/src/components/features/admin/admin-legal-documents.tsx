'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, History, CheckCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  listDocuments,
  createDocument,
  getDocumentHistory,
  type LegalDocument,
  type LegalDocumentHistory,
  type PaginationMeta,
} from '@/lib/api/admin-legal';

const DOCUMENT_TYPES = [
  { value: 'TERMS_OF_SERVICE', label: 'Termos de Servico' },
  { value: 'PRIVACY_POLICY', label: 'Politica de Privacidade' },
  { value: 'COOKIE_POLICY', label: 'Politica de Cookies' },
  { value: 'MARKETPLACE_TERMS', label: 'Termos do Marketplace' },
  { value: 'RETURN_POLICY', label: 'Politica de Devolucao' },
  { value: 'SELLER_AGREEMENT', label: 'Contrato do Vendedor' },
  { value: 'SUBSCRIPTION_TERMS', label: 'Termos de Assinatura' },
  { value: 'DATA_PROCESSING', label: 'Processamento de Dados' },
];

function getTypeLabel(type: string): string {
  return DOCUMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

export function AdminLegalDocuments() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formType, setFormType] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formEffectiveDate, setFormEffectiveDate] = useState('');
  const [formMandatory, setFormMandatory] = useState(true);
  const [creating, setCreating] = useState(false);

  // History dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyType, setHistoryType] = useState('');
  const [historyItems, setHistoryItems] = useState<LegalDocumentHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDocuments({ page, limit: 50 });
      setDocuments(result.data);
      setPagination(result.pagination);
    } catch {
      toast.error('Erro ao carregar documentos legais');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async () => {
    if (!formType || !formContent.trim() || !formEffectiveDate) return;
    setCreating(true);
    try {
      await createDocument({
        type: formType,
        content: formContent,
        isMandatory: formMandatory,
        effectiveDate: formEffectiveDate,
      });
      toast.success('Documento criado com sucesso');
      setCreateDialogOpen(false);
      resetForm();
      fetchDocuments();
    } catch {
      toast.error('Erro ao criar documento');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormType('');
    setFormContent('');
    setFormEffectiveDate('');
    setFormMandatory(true);
  };

  const openHistory = async (type: string) => {
    setHistoryType(type);
    setHistoryDialogOpen(true);
    setLoadingHistory(true);
    try {
      const data = await getDocumentHistory(type);
      setHistoryItems(data);
    } catch {
      toast.error('Erro ao carregar historico');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Group documents by type - show latest for each type
  const latestByType = new Map<string, LegalDocument>();
  for (const doc of documents) {
    const existing = latestByType.get(doc.type);
    if (!existing || doc.version > existing.version) {
      latestByType.set(doc.type, doc);
    }
  }
  const groupedDocs = Array.from(latestByType.values()).sort((a, b) =>
    a.type.localeCompare(b.type),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {pagination ? `${pagination.total} documento(s)` : ''}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Documento
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : groupedDocs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum documento legal encontrado.</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Versao</TableHead>
                  <TableHead>Data de Vigencia</TableHead>
                  <TableHead>Obrigatorio</TableHead>
                  <TableHead>Atualizado em</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {getTypeLabel(doc.type)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{doc.version}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(doc.effectiveDate)}
                    </TableCell>
                    <TableCell>
                      {doc.isMandatory ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sim
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Nao</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(doc.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openHistory(doc.type)}
                      >
                        <History className="h-4 w-4 mr-1" />
                        Historico
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Proxima
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Document Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Documento Legal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de documento</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conteudo</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Conteudo do documento legal..."
                rows={10}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effective-date">Data de vigencia</Label>
                <Input
                  id="effective-date"
                  type="date"
                  value={formEffectiveDate}
                  onChange={(e) => setFormEffectiveDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 pt-7">
                <Switch
                  checked={formMandatory}
                  onCheckedChange={setFormMandatory}
                  id="mandatory"
                />
                <Label htmlFor="mandatory">Obrigatorio</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !formType || !formContent.trim() || !formEffectiveDate}
            >
              {creating ? 'Criando...' : 'Criar Documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Historico - {getTypeLabel(historyType)}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-96 overflow-y-auto">
            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : historyItems.length === 0 ? (
              <p className="text-center text-muted-foreground">
                Nenhum historico encontrado.
              </p>
            ) : (
              <div className="space-y-3">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">v{item.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {item.content.slice(0, 200)}
                      {item.content.length > 200 ? '...' : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
