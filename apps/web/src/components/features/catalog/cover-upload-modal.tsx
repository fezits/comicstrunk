'use client';

import { useState, useRef } from 'react';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import apiClient from '@/lib/api/client';

interface CoverUploadModalProps {
  catalogEntryId: string;
  catalogEntryTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}

export function CoverUploadModal({
  catalogEntryId,
  catalogEntryTitle,
  open,
  onOpenChange,
  onSubmitted,
}: CoverUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande (máximo 5MB)');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      toast.error('Apenas JPEG, PNG ou WebP');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('cover', file);
      await apiClient.post(`/catalog/${catalogEntryId}/cover-submissions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Capa enviada! Será revisada em breve.');
      setFile(null);
      setPreview(null);
      onOpenChange(false);
      onSubmitted?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar capa</DialogTitle>
          <DialogDescription className="line-clamp-2">
            {catalogEntryTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 flex gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-yellow-900 dark:text-yellow-200">
              Sua capa vai passar por aprovação. Quando aprovada, aparecerá aqui.
            </p>
          </div>

          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full aspect-[2/3] object-cover rounded-lg border"
              />
              <button
                onClick={() => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-[2/3] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-muted/30 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Selecionar imagem</span>
              <span className="text-xs text-muted-foreground">JPEG, PNG ou WebP — até 5MB</span>
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || submitting} className="gap-2">
            <Check className="h-4 w-4" />
            {submitting ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
