'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FolderOpen, BookOpen, Tag, Users } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const contentSections = [
  {
    titleKey: 'admin.content.categories',
    descriptionKey: 'admin.content.categoriesDesc',
    href: '/admin/content/categories',
    icon: FolderOpen,
  },
  {
    titleKey: 'admin.content.series',
    descriptionKey: 'admin.content.seriesDesc',
    href: '/admin/content/series',
    icon: BookOpen,
  },
  {
    titleKey: 'admin.content.tags',
    descriptionKey: 'admin.content.tagsDesc',
    href: '/admin/content/tags',
    icon: Tag,
  },
  {
    titleKey: 'admin.content.characters',
    descriptionKey: 'admin.content.charactersDesc',
    href: '/admin/content/characters',
    icon: Users,
  },
];

export default function AdminContentPage() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {t('admin.content.title')}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {contentSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={`/${locale}${section.href}`}>
              <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {t(section.titleKey)}
                      </CardTitle>
                      <CardDescription>
                        {t(section.descriptionKey)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
