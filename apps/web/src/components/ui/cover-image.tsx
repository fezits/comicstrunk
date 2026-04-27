'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { CoverUploadModal } from '@/components/features/catalog/cover-upload-modal';
import { useAuth } from '@/lib/auth/use-auth';

const PLACEHOLDER_URL = 'https://covers.comicstrunk.com/cover-placeholder.jpg';

interface CoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: string;
  /** Optional — if provided AND src is null/error, show "enviar capa" overlay for logged users */
  catalogEntryId?: string;
  catalogEntryTitle?: string;
}

export function CoverImage({
  src,
  alt,
  className = 'h-full w-full object-cover',
  catalogEntryId,
  catalogEntryTitle,
}: CoverImageProps) {
  const [failed, setFailed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const hasRealCover = !!src && !failed;
  const finalSrc = hasRealCover ? src : PLACEHOLDER_URL;
  const showUploadOverlay = !hasRealCover && isAuthenticated && !!catalogEntryId;

  return (
    <>
      <div className="relative h-full w-full group/cover">
        <img
          src={finalSrc}
          alt={alt}
          className={className}
          loading="lazy"
          onError={() => {
            if (!failed) setFailed(true);
          }}
        />
        {showUploadOverlay && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setModalOpen(true);
            }}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-1 cursor-pointer"
            aria-label="Enviar capa"
          >
            <Upload className="h-6 w-6" />
            <span className="text-xs font-medium px-2 text-center">Enviar capa</span>
          </button>
        )}
      </div>
      {showUploadOverlay && (
        <CoverUploadModal
          catalogEntryId={catalogEntryId!}
          catalogEntryTitle={catalogEntryTitle || alt}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      )}
    </>
  );
}
