'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BatchAddBySeries } from './batch-add-by-series';
import { BatchAddQuick } from './batch-add-quick';

export function BatchAddPage() {
  const t = useTranslations('batchAdd');
  const [sessionCount, setSessionCount] = useState(0);

  const handleAdded = (count: number) => {
    setSessionCount((prev) => prev + count);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>

      <Tabs defaultValue="series">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="series">{t('tabSeries')}</TabsTrigger>
          <TabsTrigger value="quick">{t('tabQuick')}</TabsTrigger>
        </TabsList>

        <TabsContent value="series" className="mt-6">
          <BatchAddBySeries onAdded={handleAdded} />
        </TabsContent>

        <TabsContent value="quick" className="mt-6">
          <BatchAddQuick onAdded={handleAdded} sessionCount={sessionCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
