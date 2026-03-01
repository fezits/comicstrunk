'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MapPin, Pencil, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AddressForm } from '@/components/features/checkout/address-form';
import {
  listAddresses,
  deleteAddress,
  setDefaultAddress,
  type ShippingAddress,
} from '@/lib/api/shipping';

function formatAddress(addr: ShippingAddress): string {
  const parts = [
    `${addr.street}, ${addr.number}`,
    addr.complement,
    addr.neighborhood,
    `${addr.city} - ${addr.state}`,
    addr.zipCode,
  ].filter(Boolean);
  return parts.join(', ');
}

export default function AddressesPage() {
  const t = useTranslations('addresses');
  const tCommon = useTranslations('common');

  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAddresses = async () => {
    try {
      const addrs = await listAddresses();
      setAddresses(addrs);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleAddressSaved = (_address: ShippingAddress) => {
    setShowForm(false);
    setEditingAddress(undefined);
    fetchAddresses();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success(t('deleteSuccess'));
    } catch {
      toast.error(t('deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAddress(id);
      toast.success(t('defaultUpdated'));
      fetchAddresses();
    } catch {
      toast.error(tCommon('error'));
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <Button
          onClick={() => {
            setEditingAddress(undefined);
            setShowForm(true);
          }}
        >
          {t('addAddress')}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <MapPin className="h-16 w-16 text-muted-foreground/30 mx-auto" />
          <p className="text-lg text-muted-foreground">{t('noAddresses')}</p>
          <Button onClick={() => setShowForm(true)}>{t('addAddress')}</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <Card key={addr.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {addr.label || `${addr.street}, ${addr.number}`}
                    </span>
                    {addr.isDefault && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {t('defaultAddress')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{formatAddress(addr)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!addr.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSetDefault(addr.id)}
                      title={t('setDefault')}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setEditingAddress(addr);
                      setShowForm(true);
                    }}
                    title={tCommon('edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeletingId(addr.id)}
                    title={tCommon('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit address dialog */}
      <Dialog open={showForm} onOpenChange={(open) => {
        if (!open) {
          setShowForm(false);
          setEditingAddress(undefined);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? t('editAddress') : t('addAddress')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingAddress ? t('editAddress') : t('addAddress')}
            </DialogDescription>
          </DialogHeader>
          <AddressForm
            address={editingAddress}
            onSaved={handleAddressSaved}
            onCancel={() => {
              setShowForm(false);
              setEditingAddress(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteAddress')}</DialogTitle>
            <DialogDescription>{t('confirmDelete')}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              {tCommon('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
