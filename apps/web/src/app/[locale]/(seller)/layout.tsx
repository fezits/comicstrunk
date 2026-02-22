import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main className="pt-16 lg:pl-64">
        <div className="container mx-auto px-4 py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
