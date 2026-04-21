'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createAddress,
  updateAddress,
  type ShippingAddress,
  type CreateAddressData,
} from '@/lib/api/shipping';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const addressFormSchema = z.object({
  label: z.string().max(50).optional().or(z.literal('')),
  street: z.string().min(1, 'Campo obrigatorio').max(200),
  number: z.string().min(1, 'Campo obrigatorio').max(20),
  complement: z.string().max(100).optional().or(z.literal('')),
  neighborhood: z.string().min(1, 'Campo obrigatorio').max(100),
  city: z.string().min(1, 'Campo obrigatorio').max(100),
  state: z.string().length(2, 'Selecione o estado'),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato 00000-000'),
  isDefault: z.boolean(),
});

type AddressFormValues = z.infer<typeof addressFormSchema>;

function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

interface AddressFormProps {
  address?: ShippingAddress;
  onSaved: (address: ShippingAddress) => void;
  onCancel?: () => void;
}

export function AddressForm({ address, onSaved, onCancel }: AddressFormProps) {
  const t = useTranslations('addresses');
  const tCommon = useTranslations('common');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      label: address?.label ?? '',
      street: address?.street ?? '',
      number: address?.number ?? '',
      complement: address?.complement ?? '',
      neighborhood: address?.neighborhood ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      zipCode: address?.zipCode ?? '',
      isDefault: address?.isDefault ?? false,
    },
  });

  const stateValue = watch('state');
  const isDefaultValue = watch('isDefault');

  const onSubmit = async (data: AddressFormValues) => {
    try {
      const payload: CreateAddressData = {
        street: data.street,
        number: data.number,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state.toUpperCase(),
        zipCode: data.zipCode.replace('-', ''),
        isDefault: data.isDefault,
      };
      if (data.label && data.label.trim()) payload.label = data.label.trim();
      if (data.complement && data.complement.trim()) payload.complement = data.complement.trim();

      let saved: ShippingAddress;
      if (address) {
        saved = await updateAddress(address.id, payload);
        toast.success(t('updateSuccess'));
      } else {
        saved = await createAddress(payload);
        toast.success(t('createSuccess'));
      }
      onSaved(saved);
    } catch {
      toast.error(tCommon('error'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label htmlFor="label">{t('label')}</Label>
        <Input
          id="label"
          placeholder={t('labelPlaceholder')}
          {...register('label')}
        />
        {errors.label && (
          <p className="text-xs text-destructive">{errors.label.message}</p>
        )}
      </div>

      {/* Street + Number */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="street">{t('street')}</Label>
          <Input id="street" {...register('street')} />
          {errors.street && (
            <p className="text-xs text-destructive">{errors.street.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="number">{t('number')}</Label>
          <Input id="number" {...register('number')} />
          {errors.number && (
            <p className="text-xs text-destructive">{errors.number.message}</p>
          )}
        </div>
      </div>

      {/* Complement */}
      <div className="space-y-1.5">
        <Label htmlFor="complement">{t('complement')}</Label>
        <Input id="complement" {...register('complement')} />
      </div>

      {/* Neighborhood */}
      <div className="space-y-1.5">
        <Label htmlFor="neighborhood">{t('neighborhood')}</Label>
        <Input id="neighborhood" {...register('neighborhood')} />
        {errors.neighborhood && (
          <p className="text-xs text-destructive">{errors.neighborhood.message}</p>
        )}
      </div>

      {/* City + State + CEP */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">{t('city')}</Label>
          <Input id="city" {...register('city')} />
          {errors.city && (
            <p className="text-xs text-destructive">{errors.city.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>{t('state')}</Label>
          <Select
            value={stateValue}
            onValueChange={(val) => setValue('state', val, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.state && (
            <p className="text-xs text-destructive">{errors.state.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zipCode">{t('zipCode')}</Label>
          <Input
            id="zipCode"
            placeholder="00000-000"
            {...register('zipCode', {
              onChange: (e) => {
                e.target.value = formatCep(e.target.value);
              },
            })}
          />
          {errors.zipCode && (
            <p className="text-xs text-destructive">{errors.zipCode.message}</p>
          )}
        </div>
      </div>

      {/* Default checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="isDefault"
          checked={isDefaultValue}
          onCheckedChange={(checked) =>
            setValue('isDefault', checked === true, { shouldValidate: true })
          }
        />
        <Label htmlFor="isDefault" className="cursor-pointer text-sm">
          {t('defaultAddress')}
        </Label>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? tCommon('loading')
            : address
              ? tCommon('save')
              : t('addAddress')}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}
