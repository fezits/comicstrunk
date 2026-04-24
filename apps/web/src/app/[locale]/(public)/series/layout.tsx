import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Series de Quadrinhos — Acompanhe sua Colecao',
  description: 'Navegue por milhares de series de quadrinhos, gibis e mangas. Acompanhe o progresso da sua colecao serie por serie. Batman, Dragon Ball, One Piece e mais.',
  keywords: ['series quadrinhos', 'colecao serie', 'serie batman', 'serie dragon ball', 'serie one piece', 'series mangas', 'series hq'],
  openGraph: {
    title: 'Series de Quadrinhos — Comics Trunk',
    description: 'Milhares de series catalogadas. Acompanhe o progresso da sua colecao.',
    url: 'https://comicstrunk.com/pt-BR/series',
  },
  alternates: { canonical: 'https://comicstrunk.com/pt-BR/series' },
};

export default function SeriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
