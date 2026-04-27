import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Catalogo de Quadrinhos — Gibis, HQs, Mangas e Comics',
  description: 'Explore nosso catalogo com mais de 114 mil quadrinhos. Encontre gibis, HQs, mangas, comics importados. Pesquise por titulo, editora, serie ou personagem. Panini, DC Comics, Marvel, Image Comics e mais.',
  keywords: ['catalogo quadrinhos', 'buscar gibis', 'buscar mangas', 'quadrinhos panini', 'quadrinhos marvel', 'quadrinhos dc comics', 'mangas brasil', 'hqs brasil', 'comics importados'],
  openGraph: {
    title: 'Catalogo de Quadrinhos — Comics Trunk',
    description: 'Mais de 114 mil quadrinhos catalogados. Encontre gibis, HQs, mangas e comics de todas as editoras.',
    url: 'https://comicstrunk.com/pt-BR/catalog',
  },
  alternates: { canonical: 'https://comicstrunk.com/pt-BR/catalog' },
};

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
