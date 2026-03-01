'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DisputeEvidence } from '@/lib/api/disputes';

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

interface EvidenceGalleryProps {
  evidence: DisputeEvidence[];
  title?: string;
}

export function EvidenceGallery({ evidence, title }: EvidenceGalleryProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<DisputeEvidence | null>(null);

  if (evidence.length === 0) {
    return (
      <div className="text-center py-6">
        <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma evidencia enviada.</p>
      </div>
    );
  }

  return (
    <>
      {title && (
        <h4 className="text-sm font-medium text-muted-foreground mb-3">{title}</h4>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {evidence.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedEvidence(item)}
            className="group relative aspect-square rounded-lg overflow-hidden bg-muted border hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <img
              src={item.imageUrl}
              alt={item.description ?? 'Evidencia'}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-[10px] text-white truncate">
                {item.submittedBy.name}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Full-size image dialog */}
      <Dialog
        open={selectedEvidence !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvidence(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evidencia</DialogTitle>
          </DialogHeader>
          {selectedEvidence && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img
                  src={selectedEvidence.imageUrl}
                  alt={selectedEvidence.description ?? 'Evidencia'}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
              {selectedEvidence.description && (
                <p className="text-sm">{selectedEvidence.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Enviado por: {selectedEvidence.submittedBy.name}</span>
                <span>{formatDateTime(selectedEvidence.createdAt)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
