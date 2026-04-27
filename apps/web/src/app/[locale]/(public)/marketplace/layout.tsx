import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace de Quadrinhos — Compre e Venda Gibis',
  description: 'Compre e venda quadrinhos usados e novos. Marketplace seguro para colecionadores de gibis, HQs e mangas. Pagamento via PIX. Envio para todo o Brasil.',
  keywords: ['comprar quadrinhos', 'vender quadrinhos', 'marketplace gibis', 'quadrinhos usados', 'comprar gibis', 'vender gibis', 'comprar mangas', 'vender mangas'],
  openGraph: {
    title: 'Marketplace de Quadrinhos — Comics Trunk',
    description: 'Compre e venda quadrinhos de forma segura. Pagamento via PIX.',
    url: 'https://comicstrunk.com/pt-BR/marketplace',
  },
  alternates: { canonical: 'https://comicstrunk.com/pt-BR/marketplace' },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
