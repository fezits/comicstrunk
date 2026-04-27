import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogCard } from '@/components/features/catalog/catalog-card';
import type { CatalogEntry } from '@/lib/api/catalog';

vi.mock('next-intl', () => ({
  useLocale: () => 'pt-BR',
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      noReviews: 'Sem avaliacoes',
      reviews: 'avaliacoes',
      addToCollection: 'Adicionar a colecao',
      favorite: 'Favoritar',
      trade: 'Trocar',
      'detail.author': 'Autor',
      'detail.publisher': 'Editora',
      releaseDate: 'Data',
    };
    return map[key] ?? key;
  },
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockEntry: CatalogEntry = {
  id: 'entry-1',
  slug: 'turma-da-monica-vol-1',
  title: 'Turma da Monica Vol. 1',
  author: 'Mauricio de Sousa',
  publisher: 'Panini Comics',
  imprint: null,
  barcode: null,
  isbn: null,
  description: null,
  coverImageUrl: null,
  approvalStatus: 'APPROVED',
  averageRating: 4.5,
  ratingCount: 12,
  volumeNumber: 1,
  editionNumber: 1,
  coverPrice: null,
  publishYear: null,
  publishMonth: null,
  pageCount: null,
  coverFileName: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  series: {
    id: 'series-1',
    slug: 'turma-da-monica',
    title: 'Turma da Monica',
    description: null,
    totalEditions: 10,
  },
  categories: [],
  tags: [],
  characters: [],
};

describe('CatalogCard', () => {
  it('renders the entry title', () => {
    render(<CatalogCard entry={mockEntry} />);
    expect(screen.getByText('Turma da Monica Vol. 1')).toBeInTheDocument();
  });

  it('renders author when present', () => {
    render(<CatalogCard entry={mockEntry} />);
    expect(screen.getByText('Mauricio de Sousa')).toBeInTheDocument();
    expect(screen.getByText('Autor:')).toBeInTheDocument();
  });

  it('renders publisher when present', () => {
    render(<CatalogCard entry={mockEntry} />);
    expect(screen.getByText('Panini Comics')).toBeInTheDocument();
    expect(screen.getByText('Editora:')).toBeInTheDocument();
  });

  it('renders series badge when series exists', () => {
    render(<CatalogCard entry={mockEntry} />);
    expect(screen.getByText('Turma da Monica')).toBeInTheDocument();
  });

  it('does not render series badge when series is null', () => {
    const entryNoSeries = { ...mockEntry, series: null };
    render(<CatalogCard entry={entryNoSeries} />);
    expect(screen.queryByText('Turma da Monica')).not.toBeInTheDocument();
  });

  it('does not render author when null', () => {
    const entryNoAuthor = { ...mockEntry, author: null };
    render(<CatalogCard entry={entryNoAuthor} />);
    expect(screen.queryByText('Autor:')).not.toBeInTheDocument();
  });

  it('renders star rating', () => {
    render(<CatalogCard entry={mockEntry} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(12 avaliacoes)')).toBeInTheDocument();
  });

  it('links to the catalog detail page', () => {
    render(<CatalogCard entry={mockEntry} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/pt-BR/catalog/entry-1');
  });

  it('renders action buttons with correct titles', () => {
    render(<CatalogCard entry={mockEntry} />);
    expect(screen.getByTitle('Adicionar a colecao')).toBeInTheDocument();
    expect(screen.getByTitle('Favoritar')).toBeInTheDocument();
    expect(screen.getByTitle('Trocar')).toBeInTheDocument();
  });

  it('trade button is disabled', () => {
    render(<CatalogCard entry={mockEntry} />);
    const tradeBtn = screen.getByTitle('Trocar');
    expect(tradeBtn).toBeDisabled();
  });

  it('action buttons stop event propagation (don\'t navigate)', () => {
    render(<CatalogCard entry={mockEntry} />);
    const addBtn = screen.getByTitle('Adicionar a colecao');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    const stopPropSpy = vi.spyOn(event, 'stopPropagation');
    fireEvent(addBtn, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(stopPropSpy).toHaveBeenCalled();
  });

  it('renders placeholder when no cover image', () => {
    const { container } = render(<CatalogCard entry={mockEntry} />);
    // BookOpen icon placeholder should be present (SVG)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders cover image when coverImageUrl is set', () => {
    const entryWithCover = { ...mockEntry, coverImageUrl: 'https://example.com/cover.jpg' };
    render(<CatalogCard entry={entryWithCover} />);
    const img = screen.getByAltText('Turma da Monica Vol. 1');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
  });
});
