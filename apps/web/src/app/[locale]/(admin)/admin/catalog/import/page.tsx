'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowLeft, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { importCSV } from '@/lib/api/admin-catalog';

export default function CatalogImportPage() {
  const t = useTranslations('admin.catalog');
  const locale = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    errors: Array<{ row: number; message: string }>;
    total: number;
  } | null>(null);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await importCSV(file);
      setResult(res);
      if (res.errors.length === 0) {
        toast.success(`${res.created} ${t('created')}`);
      } else {
        toast.warning(`${res.created} ${t('created')}, ${res.errors.length} ${t('errors')}`);
      }
    } catch {
      toast.error(t('importError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${locale}/admin/catalog`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{t('import')}</h1>
      </div>

      {/* Upload */}
      <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
        <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">{t('importHint')}</p>
        <Input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx"
          className="max-w-xs mx-auto"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
          }}
        />
        <Button onClick={handleImport} disabled={!file || loading}>
          {loading ? t('importing') : t('import')}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="text-green-600 font-medium">
              {result.created} {t('created')}
            </span>
            {result.errors.length > 0 && (
              <span className="text-destructive ml-3">
                {result.errors.length} {t('errors')}
              </span>
            )}
            <span className="text-muted-foreground ml-3">
              ({result.total} total)
            </span>
          </p>

          {result.errors.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">{t('row')}</TableHead>
                  <TableHead>{t('error')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((err, i) => (
                  <TableRow key={i}>
                    <TableCell>{err.row}</TableCell>
                    <TableCell className="text-destructive">{err.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
