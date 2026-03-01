'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Image,
  BookOpen,
  Tag,
  Ticket,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  type AdminHomepageSection,
  type HomepageSectionType,
} from '@/lib/api/homepage';

const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  BANNER_CAROUSEL: 'Carrossel de Banners',
  CATALOG_HIGHLIGHTS: 'Destaques do Catalogo',
  DEALS_OF_DAY: 'Ofertas do Dia',
  FEATURED_COUPONS: 'Cupons em Destaque',
};

const SECTION_TYPE_DESCRIPTIONS: Record<HomepageSectionType, string> = {
  BANNER_CAROUSEL:
    'Exibe banners rotativos. Preenche automaticamente com ofertas que possuem banner ou selecione manualmente.',
  CATALOG_HIGHLIGHTS:
    'Mostra destaques do catalogo. Preenche automaticamente com os mais bem avaliados ou selecione manualmente.',
  DEALS_OF_DAY:
    'Ofertas com prazo de expiracao proximo. Preenche automaticamente com ofertas expirando em breve.',
  FEATURED_COUPONS:
    'Cupons ativos em destaque. Preenche automaticamente com cupons ativos ou selecione manualmente.',
};

function getSectionIcon(type: HomepageSectionType) {
  switch (type) {
    case 'BANNER_CAROUSEL':
      return <Image className="h-4 w-4" />;
    case 'CATALOG_HIGHLIGHTS':
      return <BookOpen className="h-4 w-4" />;
    case 'DEALS_OF_DAY':
      return <Tag className="h-4 w-4" />;
    case 'FEATURED_COUPONS':
      return <Ticket className="h-4 w-4" />;
  }
}

export function AdminHomepageSections() {
  const [sections, setSections] = useState<AdminHomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newType, setNewType] = useState<HomepageSectionType>('BANNER_CAROUSEL');
  const [newTitle, setNewTitle] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<AdminHomepageSection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSections();
      setSections(data);
    } catch {
      toast.error('Erro ao carregar secoes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const handleToggleVisibility = async (section: AdminHomepageSection) => {
    try {
      await updateSection(section.id, { isVisible: !section.isVisible });
      toast.success(section.isVisible ? 'Secao ocultada' : 'Secao visivel');
      fetchSections();
    } catch {
      toast.error('Erro ao alterar visibilidade');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    setSaving(true);
    try {
      const newOrder = [...sections];
      const temp = newOrder[index];
      newOrder[index] = newOrder[index - 1];
      newOrder[index - 1] = temp;

      const orderedIds = newOrder.map((s) => s.id);
      const updated = await reorderSections(orderedIds);
      setSections(updated);
      toast.success('Ordem atualizada');
    } catch {
      toast.error('Erro ao reordenar');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === sections.length - 1) return;
    setSaving(true);
    try {
      const newOrder = [...sections];
      const temp = newOrder[index];
      newOrder[index] = newOrder[index + 1];
      newOrder[index + 1] = temp;

      const orderedIds = newOrder.map((s) => s.id);
      const updated = await reorderSections(orderedIds);
      setSections(updated);
      toast.success('Ordem atualizada');
    } catch {
      toast.error('Erro ao reordenar');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newType) {
      toast.error('Selecione o tipo da secao');
      return;
    }
    setSaving(true);
    try {
      await createSection({
        type: newType,
        title: newTitle.trim() || undefined,
        sortOrder: sections.length,
        isVisible: true,
      });
      toast.success('Secao criada com sucesso');
      setCreateOpen(false);
      setNewTitle('');
      fetchSections();
    } catch {
      toast.error('Erro ao criar secao');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSection(deleteTarget.id);
      toast.success('Secao excluida');
      setDeleteTarget(null);
      fetchSections();
    } catch {
      toast.error('Erro ao excluir secao');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {sections.length} secao{sections.length !== 1 ? 'es' : ''} configurada{sections.length !== 1 ? 's' : ''}
        </span>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Secao
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nenhuma secao configurada. Adicione secoes para personalizar a homepage.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div
              key={section.id}
              className="rounded-md border bg-card"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Type Icon */}
                <div className="text-muted-foreground">
                  {getSectionIcon(section.type)}
                </div>

                {/* Title and Type */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() =>
                    setExpandedId(expandedId === section.id ? null : section.id)
                  }
                >
                  <div className="font-medium text-sm truncate">
                    {section.title || SECTION_TYPE_LABELS[section.type]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {SECTION_TYPE_LABELS[section.type]}
                  </div>
                </div>

                {/* Visibility Badge */}
                <Badge variant={section.isVisible ? 'default' : 'secondary'} className="text-xs">
                  {section.isVisible ? 'Visivel' : 'Oculta'}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleToggleVisibility(section)}
                    title={section.isVisible ? 'Ocultar' : 'Mostrar'}
                  >
                    {section.isVisible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={index === 0 || saving}
                    onClick={() => handleMoveUp(index)}
                    title="Mover para cima"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={index === sections.length - 1 || saving}
                    onClick={() => handleMoveDown(index)}
                    title="Mover para baixo"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(section)}
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === section.id && (
                <div className="px-4 pb-3 border-t pt-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    {SECTION_TYPE_DESCRIPTIONS[section.type]}
                  </p>
                  {section.contentRefs && Object.keys(section.contentRefs).length > 0 ? (
                    <div className="text-xs text-muted-foreground bg-muted rounded-md p-2 font-mono">
                      {JSON.stringify(section.contentRefs, null, 2)}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Sem conteudo manual configurado - usando preenchimento automatico.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Secao</DialogTitle>
            <DialogDescription>
              Adicione uma nova secao a homepage. O conteudo sera preenchido automaticamente ou pode
              ser configurado manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo da Secao *</Label>
              <Select
                value={newType}
                onValueChange={(v) => setNewType(v as HomepageSectionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANNER_CAROUSEL">Carrossel de Banners</SelectItem>
                  <SelectItem value="CATALOG_HIGHLIGHTS">Destaques do Catalogo</SelectItem>
                  <SelectItem value="DEALS_OF_DAY">Ofertas do Dia</SelectItem>
                  <SelectItem value="FEATURED_COUPONS">Cupons em Destaque</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {SECTION_TYPE_DESCRIPTIONS[newType]}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-title">Titulo (opcional)</Label>
              <Input
                id="section-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Ofertas Imperdíveis"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir secao</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a secao &quot;
              {deleteTarget?.title || SECTION_TYPE_LABELS[deleteTarget?.type as HomepageSectionType]}
              &quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
