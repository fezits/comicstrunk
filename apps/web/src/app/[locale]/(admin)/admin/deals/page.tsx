'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPartnerStores } from '@/components/features/deals/admin-partner-stores';
import { AdminDealsList } from '@/components/features/deals/admin-deals-list';
import { AdminClickAnalytics } from '@/components/features/deals/admin-click-analytics';

export default function AdminDealsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Gerenciar Ofertas</h1>

      <Tabs defaultValue="deals" className="w-full">
        <TabsList>
          <TabsTrigger value="stores">Lojas Parceiras</TabsTrigger>
          <TabsTrigger value="deals">Ofertas</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="mt-6">
          <AdminPartnerStores />
        </TabsContent>

        <TabsContent value="deals" className="mt-6">
          <AdminDealsList />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <AdminClickAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
