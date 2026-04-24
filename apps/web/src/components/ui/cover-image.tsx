'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface CoverImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: string;
}

/**
 * Cover image with automatic fallback to BookOpen icon on error/404.
 * Use this everywhere covers are displayed to avoid broken images.
 */
export function CoverImage({ src, alt, className = 'h-full w-full object-cover', iconSize = 'h-12 w-12' }: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted">
        <BookOpen className={`${iconSize} text-muted-foreground/30`} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
