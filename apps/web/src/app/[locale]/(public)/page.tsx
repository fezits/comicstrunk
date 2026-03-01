import type { Metadata } from 'next';

import { HomepageContent } from '@/components/features/homepage/homepage-content';

export const metadata: Metadata = {
  title: 'Comics Trunk — Plataforma para Colecionadores de Quadrinhos',
  description:
    'Gerencie sua colecao, compre e venda quadrinhos, e encontre as melhores ofertas de gibis, HQs e mangas no Brasil.',
};

export default function HomePage() {
  return <HomepageContent />;
}
