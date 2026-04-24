import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cupons de Desconto e Ofertas de Quadrinhos',
  description: 'Cupons de desconto exclusivos para quadrinhos, gibis, HQs e mangas. Ofertas das melhores lojas: Amazon, Panini, Rika e mais. Economize na sua colecao.',
  keywords: ['cupom desconto quadrinhos', 'oferta gibis', 'desconto mangas', 'cupom panini', 'cupom amazon quadrinhos', 'promocao hq', 'desconto comics'],
  openGraph: {
    title: 'Cupons e Ofertas de Quadrinhos — Comics Trunk',
    description: 'Cupons exclusivos e ofertas das melhores lojas de quadrinhos do Brasil.',
    url: 'https://comicstrunk.com/pt-BR/deals',
  },
  alternates: { canonical: 'https://comicstrunk.com/pt-BR/deals' },
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
