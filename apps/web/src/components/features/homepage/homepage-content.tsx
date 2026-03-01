'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BookOpen, Tag, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HomepageSectionRenderer } from './homepage-section-renderer';
import { getHomepageData, type HomepageSection } from '@/lib/api/homepage';

function HeroSection() {
  const locale = useLocale();

  return (
    <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-background to-primary/5 border border-border/50">
      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25px 25px, currentColor 1px, transparent 0)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative px-6 py-12 md:px-12 md:py-20 flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="h-10 w-10 md:h-12 md:w-12 text-primary" />
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            Comics Trunk
          </h1>
        </div>

        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mb-8">
          A plataforma definitiva para colecionadores de quadrinhos no Brasil
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="gap-2">
            <Link href={`/${locale}/catalog`}>
              <Search className="h-4 w-4" />
              Explorar Catalogo
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link href={`/${locale}/deals`}>
              <Tag className="h-4 w-4" />
              Ver Ofertas
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function HomepageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <Skeleton className="w-full h-[200px] md:h-[280px] rounded-xl" />

      {/* Section skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomepageContent() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchHomepage() {
      try {
        const response = await getHomepageData();
        if (!cancelled) {
          setSections(response.data || []);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchHomepage();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <HomepageSkeleton />;
  }

  return (
    <div className="space-y-8 md:space-y-12">
      <HeroSection />

      {/* Dynamic sections from API */}
      {sections.length > 0 ? (
        sections
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((section) => (
            <HomepageSectionRenderer key={section.id} section={section} />
          ))
      ) : error ? (
        /* Fallback: on error, hero is already rendered above */
        null
      ) : null}
    </div>
  );
}
