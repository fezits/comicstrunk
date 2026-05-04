import type { Metadata } from 'next';

import { HomepageContent } from '@/components/features/homepage/homepage-content';

export const metadata: Metadata = {
  title: 'Comics Trunk — Gerencie sua Colecao de Quadrinhos, HQs e Mangas',
  description:
    'Plataforma brasileira para colecionadores de quadrinhos. Gerencie sua colecao de gibis, HQs, mangas e comics. Compre e venda no marketplace. Cupons de desconto e ofertas exclusivas. Catalogo com mais de 114 mil titulos.',
  keywords: [
    'colecao de quadrinhos',
    'gerenciar quadrinhos',
    'colecionar gibis',
    'colecao de gibis',
    'colecao de mangas',
    'colecao de HQs',
    'colecao de comics',
    'gerenciador de quadrinhos',
    'organizar quadrinhos',
    'catalogo de quadrinhos',
    'catalogo de gibis',
    'comprar quadrinhos',
    'vender quadrinhos',
    'marketplace quadrinhos',
    'cupom de desconto quadrinhos',
    'ofertas de gibis',
    'ofertas de mangas',
    'desconto panini',
    'desconto gibis',
    'manga brasil',
    'hq brasil',
    'gibi online',
    'comics trunk',
  ],
  openGraph: {
    title: 'Comics Trunk — Gerencie sua Colecao de Quadrinhos',
    description: 'Plataforma brasileira para colecionadores de quadrinhos. Catalogo com 114 mil+ titulos, marketplace, cupons de desconto e ofertas.',
    url: 'https://comicstrunk.com',
    siteName: 'Comics Trunk',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: 'https://comicstrunk.com/logo-400.png', width: 400, height: 400, alt: 'Comics Trunk' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comics Trunk — Gerencie sua Colecao de Quadrinhos',
    description: 'Catalogo com 114 mil+ quadrinhos, marketplace, cupons e ofertas. A plataforma definitiva para colecionadores.',
    images: ['https://comicstrunk.com/logo-400.png'],
  },
  alternates: {
    canonical: 'https://comicstrunk.com/pt-BR',
  },
};

export default function HomePage() {
  return <HomepageContent />;
}
