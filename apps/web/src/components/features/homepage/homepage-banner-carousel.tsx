'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { HomepageSectionItem } from '@/lib/api/homepage';

interface HomepageBannerCarouselProps {
  items: HomepageSectionItem[];
}

export function HomepageBannerCarousel({ items }: HomepageBannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const validItems = items.length > 0 ? items : [];
  const hasItems = validItems.length > 0;

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning || validItems.length === 0) return;
      setIsTransitioning(true);
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 500);
    },
    [isTransitioning, validItems.length],
  );

  const goToNext = useCallback(() => {
    if (validItems.length <= 1) return;
    goToSlide((currentIndex + 1) % validItems.length);
  }, [currentIndex, validItems.length, goToSlide]);

  const goToPrev = useCallback(() => {
    if (validItems.length <= 1) return;
    goToSlide((currentIndex - 1 + validItems.length) % validItems.length);
  }, [currentIndex, validItems.length, goToSlide]);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (validItems.length <= 1) return;
    timerRef.current = setInterval(goToNext, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [goToNext, validItems.length]);

  // Reset timer on manual navigation
  const handleManualNav = useCallback(
    (action: () => void) => {
      if (timerRef.current) clearInterval(timerRef.current);
      action();
      if (validItems.length > 1) {
        timerRef.current = setInterval(goToNext, 5000);
      }
    },
    [goToNext, validItems.length],
  );

  // Default branded banner when no items
  if (!hasItems) {
    return (
      <div className="relative w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden bg-gradient-to-br from-primary/30 via-primary/10 to-background border border-border/50">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <BookOpen className="h-16 w-16 text-primary/40" />
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Comics Trunk</h2>
            <p className="text-muted-foreground mt-2">
              A plataforma definitiva para colecionadores de quadrinhos
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden group">
      {/* Slides */}
      <div className="relative w-full h-full">
        {validItems.map((item, index) => {
          const imageUrl = item.bannerUrl || item.coverUrl;
          return (
            <div
              key={item.id}
              className={cn(
                'absolute inset-0 transition-opacity duration-500',
                index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0',
              )}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center">
                  <BookOpen className="h-20 w-20 text-primary/20" />
                </div>
              )}

              {/* Overlay with title */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-white text-lg md:text-xl font-bold line-clamp-2">
                  {item.title}
                </h3>
                {item.discount && (
                  <span className="inline-block mt-2 bg-emerald-600 text-white text-sm font-bold px-3 py-1 rounded-md">
                    {item.discount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation arrows */}
      {validItems.length > 1 && (
        <>
          <button
            onClick={() => handleManualNav(goToPrev)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleManualNav(goToNext)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
            aria-label="Proximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Navigation dots */}
      {validItems.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {validItems.map((_, index) => (
            <button
              key={index}
              onClick={() => handleManualNav(() => goToSlide(index))}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-white/60 hover:bg-white/80',
              )}
              aria-label={`Ir para slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
