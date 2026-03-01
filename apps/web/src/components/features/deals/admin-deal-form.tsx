'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createDeal,
  updateDeal,
  uploadDealBanner,
  listStores,
  type Deal,
  type DealType,
  type PartnerStore,
} from '@/lib/api/deals';
import { getCategories } from '@/lib/api/taxonomy';
import type { Category } from '@/lib/api/taxonomy';

interface DealFormData {
  storeId: string;
  type: DealType;
  title: string;
  description: string;
  discount: string;
  couponCode: string;
  affiliateBaseUrl: string;
  categoryId: string;
  startsAt: string;
  expiresAt: string;
}

const emptyForm: DealFormData = {
  storeId: '',
  type: 'PROMOTION',
  title: '',
  description: '',
  discount: '',
  couponCode: '',
  affiliateBaseUrl: '',
  categoryId: '',
  startsAt: '',
  expiresAt: '',
};

interface AdminDealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDeal: Deal | null;
  onSaved: () => void;
}

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function AdminDealForm({ open, onOpenChange, editingDeal, onSaved }: AdminDealFormProps) {
  const [form, setForm] = useState<DealFormData>(emptyForm);
  const [stores, setStores] = useState<PartnerStore[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadDropdownData();
      if (editingDeal) {
        setForm({
          storeId: editingDeal.storeId,
          type: editingDeal.type,
          title: editingDeal.title,
          description: editingDeal.description || '',
          discount: editingDeal.discount || '',
          couponCode: editingDeal.couponCode || '',
          affiliateBaseUrl: editingDeal.affiliateBaseUrl,
          categoryId: editingDeal.categoryId || '',
          startsAt: formatDateForInput(editingDeal.startsAt),
          expiresAt: formatDateForInput(editingDeal.expiresAt),
        });
        setBannerPreview(editingDeal.bannerUrl);
      } else {
        setForm(emptyForm);
        setBannerPreview(null);
      }
      setBannerFile(null);
    }
  }, [open, editingDeal]);

  const loadDropdownData = async () => {
    try {
      const [storesData, categoriesData] = await Promise.all([
        listStores(),
        getCategories(),
      ]);
      setStores(storesData);
      setCategories(categoriesData);
    } catch {
      toast.error('Erro ao carregar dados do formulario');
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.storeId || !form.title.trim() || !form.affiliateBaseUrl.trim()) {
      toast.error('Preencha os campos obrigatorios: loja, titulo e URL de afiliado');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        storeId: form.storeId,
        type: form.type,
        title: form.title.trim(),
        affiliateBaseUrl: form.affiliateBaseUrl.trim(),
      };

      if (form.description.trim()) payload.description = form.description.trim();
      if (form.discount.trim()) payload.discount = form.discount.trim();
      if (form.couponCode.trim()) payload.couponCode = form.couponCode.trim();
      if (form.categoryId) payload.categoryId = form.categoryId;
      if (form.startsAt) payload.startsAt = new Date(form.startsAt).toISOString();
      if (form.expiresAt) payload.expiresAt = new Date(form.expiresAt).toISOString();

      let savedDeal: Deal;

      if (editingDeal) {
        savedDeal = await updateDeal(editingDeal.id, payload);
      } else {
        savedDeal = await createDeal(payload as Parameters<typeof createDeal>[0]);
      }

      // Upload banner if a new file was selected
      if (bannerFile) {
        await uploadDealBanner(savedDeal.id, bannerFile);
      }

      toast.success(editingDeal ? 'Oferta atualizada com sucesso' : 'Oferta criada com sucesso');
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error(editingDeal ? 'Erro ao atualizar oferta' : 'Erro ao criar oferta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingDeal ? 'Editar Oferta' : 'Nova Oferta'}
          </DialogTitle>
          <DialogDescription>
            {editingDeal
              ? 'Atualize os dados da oferta.'
              : 'Cadastre uma nova oferta de afiliado.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Store select */}
          <div className="space-y-2">
            <Label>Loja Parceira *</Label>
            <Select value={form.storeId} onValueChange={(v) => setForm((p) => ({ ...p, storeId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deal-type"
                  value="PROMOTION"
                  checked={form.type === 'PROMOTION'}
                  onChange={() => setForm((p) => ({ ...p, type: 'PROMOTION' }))}
                  className="accent-primary"
                />
                <span className="text-sm">Promocao</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deal-type"
                  value="COUPON"
                  checked={form.type === 'COUPON'}
                  onChange={() => setForm((p) => ({ ...p, type: 'COUPON' }))}
                  className="accent-primary"
                />
                <span className="text-sm">Cupom</span>
              </label>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="deal-title">Titulo *</Label>
            <Input
              id="deal-title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Ex: 20% OFF em quadrinhos Marvel"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="deal-desc">Descricao</Label>
            <Textarea
              id="deal-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Descricao da oferta..."
              rows={3}
            />
          </div>

          {/* Discount */}
          <div className="space-y-2">
            <Label htmlFor="deal-discount">Desconto</Label>
            <Input
              id="deal-discount"
              value={form.discount}
              onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
              placeholder="Ex: 10% OFF ou R$ 5 desconto"
            />
          </div>

          {/* Coupon code - only visible if type is COUPON */}
          {form.type === 'COUPON' && (
            <div className="space-y-2">
              <Label htmlFor="deal-coupon">Codigo do Cupom</Label>
              <Input
                id="deal-coupon"
                value={form.couponCode}
                onChange={(e) => setForm((p) => ({ ...p, couponCode: e.target.value }))}
                placeholder="Ex: COMICS10"
                className="font-mono uppercase"
              />
            </div>
          )}

          {/* Affiliate URL */}
          <div className="space-y-2">
            <Label htmlFor="deal-url">URL de Afiliado *</Label>
            <Input
              id="deal-url"
              value={form.affiliateBaseUrl}
              onChange={(e) => setForm((p) => ({ ...p, affiliateBaseUrl: e.target.value }))}
              placeholder="https://www.amazon.com.br/dp/..."
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={form.categoryId || 'none'}
              onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v === 'none' ? '' : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deal-starts">Data de Inicio</Label>
              <Input
                id="deal-starts"
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-expires">Data de Expiracao</Label>
              <Input
                id="deal-expires"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
              />
            </div>
          </div>

          {/* Banner */}
          <div className="space-y-2">
            <Label htmlFor="deal-banner">Imagem do Banner</Label>
            <Input
              id="deal-banner"
              type="file"
              accept="image/*"
              onChange={handleBannerChange}
            />
            {bannerPreview && (
              <div className="mt-2 rounded-md border overflow-hidden">
                <img
                  src={bannerPreview}
                  alt="Preview do banner"
                  className="w-full h-32 object-cover"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
