'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { BookOpen, Tag, Search, TrendingUp, Library, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { HomepageSectionRenderer } from './homepage-section-renderer';
import { getHomepageData, type HomepageSection } from '@/lib/api/homepage';
import { searchCatalog } from '@/lib/api/catalog';

function HeroSection() {
  const locale = useLocale();

  return (
    <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 via-background to-primary/5 border border-border/50">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25px 25px, currentColor 1px, transparent 0)',
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative px-6 py-10 md:px-12 md:py-14 flex flex-col items-center text-center">
        <div className="flex flex-col items-center gap-3 mb-3">
          <img src="/logo-400.png" alt="Comics Trunk" className="h-24 md:h-32 w-auto" />
        </div>

        <p className="text-muted-foreground text-sm md:text-base max-w-2xl mb-6">
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

function SearchStatsSection() {
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState<{ entries: number; series: number } | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [catalogRes, seriesRes] = await Promise.all([
          searchCatalog({ limit: 1, page: 1 }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/series?limit=1`).then(r => r.json()),
        ]);
        setStats({
          entries: catalogRes.pagination?.total || 0,
          series: seriesRes.pagination?.total || 0,
        });
      } catch {
        // Silent fail
      }
    }
    fetchStats();
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/${locale}/catalog?title=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <section className="rounded-xl border border-border/50 bg-card/50 px-6 py-8 md:px-10 md:py-10">
      {/* Search */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Encontre seu gibi..."
            className="pl-12 h-12 text-base md:text-lg rounded-xl border-primary/30 focus-visible:ring-2 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            Buscar
          </Button>
        </div>
      </form>

      {/* Stats */}
      {stats && (
        <div className="flex items-center justify-center gap-6 md:gap-10 text-center">
          <div className="flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xl md:text-2xl font-bold">{stats.entries.toLocaleString('pt-BR')}</p>
              <p className="text-xs md:text-sm text-muted-foreground">gibis no catalogo</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xl md:text-2xl font-bold">{stats.series.toLocaleString('pt-BR')}</p>
              <p className="text-xs md:text-sm text-muted-foreground">series</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface RecentEntry {
  id: string;
  title: string;
  slug: string | null;
  coverImageUrl: string | null;
  publisher: string | null;
}

function RecentAdditions() {
  const locale = useLocale();
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    async function fetchRecent() {
      try {
        const res = await searchCatalog({
          limit: 8,
          page: 1,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        setEntries(res.data || []);
      } catch {
        // Silent fail
      }
    }
    fetchRecent();
  }, []);

  if (entries.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-semibold">Adicionados Recentemente</h2>
        <Link
          href={`/${locale}/catalog?sortBy=createdAt&sortOrder=desc`}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/${locale}/catalog/${entry.slug || entry.id}`}
            className="group rounded-lg overflow-hidden border border-border/50 bg-card hover:border-primary/50 transition-colors"
          >
            <div className="aspect-[2/3] bg-muted relative overflow-hidden">
              {entry.coverImageUrl ? (
                <img
                  src={entry.coverImageUrl}
                  alt={entry.title}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/5">
                  <BookOpen className="h-10 w-10 text-primary/20" />
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs md:text-sm font-medium truncate">{entry.title}</p>
              {entry.publisher && (
                <p className="text-xs text-muted-foreground truncate">{entry.publisher}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CtaSection() {
  const locale = useLocale();

  return (
    <section className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 px-6 py-8 md:px-10 md:py-10 text-center">
      <BookOpen className="h-8 w-8 text-primary mx-auto mb-3" />
      <h2 className="text-lg md:text-xl font-semibold mb-2">Monte sua colecao de gibis</h2>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
        Organize, acompanhe e descubra novos titulos. Cadastre-se gratuitamente.
      </p>
      <Button asChild size="lg" className="gap-2">
        <Link href={`/${locale}/signup`}>
          Criar minha conta <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

function HomepageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="w-full h-[180px] md:h-[220px] rounded-xl" />
      <Skeleton className="w-full h-[140px] rounded-xl" />
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

  // Filter out BANNER_CAROUSEL sections (replaced by SearchStats + RecentAdditions)
  const filteredSections = sections.filter(s => s.type !== 'BANNER_CAROUSEL');

  return (
    <div className="space-y-8 md:space-y-10">
      <HeroSection />
      <SearchStatsSection />
      <CtaSection />

      {/* Dynamic sections from API (excluding banner carousel) */}
      {filteredSections.length > 0 &&
        filteredSections
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((section) => (
            <HomepageSectionRenderer key={section.id} section={section} />
          ))
      }

      <RecentAdditions />
    </div>
  );
}
