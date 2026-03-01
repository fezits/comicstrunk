'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Plus, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddressForm } from './address-form';
import type { ShippingAddress } from '@/lib/api/shipping';

interface AddressSelectorProps {
  addresses: ShippingAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddressCreated: (address: ShippingAddress) => void;
}

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

export function AddressSelector({
  addresses,
  selectedId,
  onSelect,
  onAddressCreated,
}: AddressSelectorProps) {
  const t = useTranslations('addresses');
  const tCheckout = useTranslations('checkout');
  const [showForm, setShowForm] = useState(addresses.length === 0);

  const handleAddressSaved = (address: ShippingAddress) => {
    onAddressCreated(address);
    onSelect(address.id);
    setShowForm(false);
  };

  if (showForm && addresses.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('noAddresses')}</p>
        <AddressForm
          onSaved={handleAddressSaved}
          onCancel={undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Address list */}
      <div className="space-y-3">
        {addresses.map((addr) => {
          const isSelected = selectedId === addr.id;
          return (
            <Card
              key={addr.id}
              className={`cursor-pointer transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-muted-foreground/30'
              }`}
              onClick={() => onSelect(addr.id)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add new address */}
      {showForm ? (
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">{tCheckout('addNewAddress')}</h4>
          <AddressForm
            onSaved={handleAddressSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" />
          {tCheckout('addNewAddress')}
        </Button>
      )}
    </div>
  );
}
