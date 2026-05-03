'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';

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
import type { BankAccount, CreateBankAccountInput } from '@/lib/api/banking';

const bankAccountFormSchema = z
  .object({
    bankName: z.string().min(1, 'Campo obrigatorio').max(100),
    branchNumber: z.string().min(1, 'Campo obrigatorio').max(20),
    accountNumber: z.string().min(1, 'Campo obrigatorio').max(30),
    cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF invalido'),
    holderName: z.string().min(1, 'Campo obrigatorio').max(200),
    accountType: z.enum(['CHECKING', 'SAVINGS']),
    isPrimary: z.boolean(),
    pixKey: z.string().max(80).optional().or(z.literal('')),
    pixKeyType: z
      .union([z.enum(['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM']), z.literal('')])
      .optional(),
  })
  .refine(
    (v) => {
      const hasKey = !!v.pixKey && v.pixKey.trim() !== '';
      const hasType = !!v.pixKeyType && v.pixKeyType !== ('' as string);
      return hasKey === hasType;
    },
    {
      message: 'Preencha chave PIX e tipo da chave juntos, ou deixe ambos em branco',
      path: ['pixKey'],
    },
  );

type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function cpfToDigits(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function digitsToCpf(digits: string): string {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

interface BankAccountFormProps {
  account?: BankAccount;
  onSubmit: (data: CreateBankAccountInput) => Promise<void>;
  onCancel: () => void;
}

export function BankAccountForm({ account, onSubmit, onCancel }: BankAccountFormProps) {
  const t = useTranslations('banking');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: {
      bankName: account?.bankName ?? '',
      branchNumber: account?.branchNumber ?? '',
      accountNumber: account?.accountNumber ?? '',
      cpf: account?.cpf ? digitsToCpf(account.cpf) : '',
      holderName: account?.holderName ?? '',
      accountType: account?.accountType ?? 'CHECKING',
      isPrimary: account?.isPrimary ?? false,
      pixKey: account?.pixKey ?? '',
      pixKeyType: (account?.pixKeyType as BankAccountFormValues['pixKeyType']) ?? '',
    },
  });

  const accountTypeValue = watch('accountType');
  const isPrimaryValue = watch('isPrimary');
  const pixKeyTypeValue = watch('pixKeyType');

  const handleFormSubmit = async (data: BankAccountFormValues) => {
    const trimmedPix = data.pixKey?.trim() || '';
    const payload: CreateBankAccountInput = {
      bankName: data.bankName,
      branchNumber: data.branchNumber,
      accountNumber: data.accountNumber,
      cpf: cpfToDigits(data.cpf),
      holderName: data.holderName,
      accountType: data.accountType,
      isPrimary: data.isPrimary,
      pixKey: trimmedPix || null,
      pixKeyType: trimmedPix && data.pixKeyType !== '' ? data.pixKeyType : null,
    };
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Bank Name */}
      <div className="space-y-1.5">
        <Label htmlFor="bankName">{t('bankName')}</Label>
        <Input id="bankName" {...register('bankName')} />
        {errors.bankName && (
          <p className="text-xs text-destructive">{errors.bankName.message}</p>
        )}
      </div>

      {/* Branch + Account Number */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="branchNumber">{t('branch')}</Label>
          <Input id="branchNumber" {...register('branchNumber')} />
          {errors.branchNumber && (
            <p className="text-xs text-destructive">{errors.branchNumber.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accountNumber">{t('account')}</Label>
          <Input id="accountNumber" {...register('accountNumber')} />
          {errors.accountNumber && (
            <p className="text-xs text-destructive">{errors.accountNumber.message}</p>
          )}
        </div>
      </div>

      {/* CPF */}
      <div className="space-y-1.5">
        <Label htmlFor="cpf">{t('cpf')}</Label>
        <Input
          id="cpf"
          placeholder="000.000.000-00"
          {...register('cpf', {
            onChange: (e) => {
              e.target.value = formatCpf(e.target.value);
            },
          })}
        />
        {errors.cpf && (
          <p className="text-xs text-destructive">{errors.cpf.message}</p>
        )}
      </div>

      {/* Holder Name */}
      <div className="space-y-1.5">
        <Label htmlFor="holderName">{t('holder')}</Label>
        <Input id="holderName" {...register('holderName')} />
        {errors.holderName && (
          <p className="text-xs text-destructive">{errors.holderName.message}</p>
        )}
      </div>

      {/* Account Type */}
      <div className="space-y-1.5">
        <Label>{t('accountType')}</Label>
        <Select
          value={accountTypeValue}
          onValueChange={(val) =>
            setValue('accountType', val as 'CHECKING' | 'SAVINGS', { shouldValidate: true })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CHECKING">{t('checking')}</SelectItem>
            <SelectItem value="SAVINGS">{t('savings')}</SelectItem>
          </SelectContent>
        </Select>
        {errors.accountType && (
          <p className="text-xs text-destructive">{errors.accountType.message}</p>
        )}
      </div>

      {/* Is Primary */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="isPrimary"
          checked={isPrimaryValue}
          onCheckedChange={(checked) =>
            setValue('isPrimary', checked === true, { shouldValidate: true })
          }
        />
        <Label htmlFor="isPrimary" className="cursor-pointer text-sm">
          {t('isPrimary')}
        </Label>
      </div>

      {/* PIX (opcional) */}
      <div className="space-y-3 rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          PIX (opcional) — preencha se quiser receber por chave PIX além da TED.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pixKey">Chave PIX</Label>
            <Input id="pixKey" placeholder="Ex: 00000000000 (CPF) ou email@dominio.com" {...register('pixKey')} />
            {errors.pixKey && (
              <p className="text-xs text-destructive">{errors.pixKey.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Tipo da chave</Label>
            <Select
              value={pixKeyTypeValue || ''}
              onValueChange={(val) =>
                setValue('pixKeyType', val as BankAccountFormValues['pixKeyType'], { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="CNPJ">CNPJ</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="PHONE">Telefone</SelectItem>
                <SelectItem value="RANDOM">Aleatoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : t('save')}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
