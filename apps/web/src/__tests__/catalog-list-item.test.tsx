import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogListItem } from '@/components/features/catalog/catalog-list-item';
import type { CatalogEntry } from '@/lib/api/catalog';

vi.mock('next-intl', () => ({
  useLocale: () => 'pt-BR',
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      noReviews: 'Sem avaliacoes',
      reviews: 'avaliacoes',
      addToCollection: 'Adicionar a colecao',
      favorite: 'Favoritar',
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
  id: 'entry-2',
  title: 'One Piece Vol. 100',
  author: 'Eiichiro Oda',
  publisher: 'Panini',
  imprint: null,
  barcode: null,
  isbn: null,
  description: null,
  coverImageUrl: 'https://example.com/op100.jpg',
  approvalStatus: 'APPROVED',
  averageRating: 5,
  ratingCount: 99,
  volumeNumber: 100,
  editionNumber: 1,
  coverPrice: null,
  publishYear: null,
  publishMonth: null,
  pageCount: null,
  coverFileName: null,
  createdAt: '2025-06-01T00:00:00.000Z',
  series: {
    id: 'series-op',
    title: 'One Piece',
    description: null,
    totalEditions: 109,
  },
  categories: [],
  tags: [],
  characters: [],
};

describe('CatalogListItem', () => {
  it('renders the entry title', () => {
    render(<CatalogListItem entry={mockEntry} />);
    expect(screen.getByText('One Piece Vol. 100')).toBeInTheDocument();
  });

  it('renders author', () => {
    render(<CatalogListItem entry={mockEntry} />);
    expect(screen.getByText('Eiichiro Oda')).toBeInTheDocument();
  });

  it('renders publisher', () => {
    render(<CatalogListItem entry={mockEntry} />);
    expect(screen.getByText('Panini')).toBeInTheDocument();
  });

  it('renders series badge', () => {
    render(<CatalogListItem entry={mockEntry} />);
    expect(screen.getByText('One Piece')).toBeInTheDocument();
  });

  it('does not render series badge when null', () => {
    const noSeries = { ...mockEntry, series: null };
    render(<CatalogListItem entry={noSeries} />);
    expect(screen.queryByText('One Piece')).not.toBeInTheDocument();
  });

  it('links to catalog detail page', () => {
    render(<CatalogListItem entry={mockEntry} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/pt-BR/catalog/entry-2');
  });

  it('renders cover image', () => {
    render(<CatalogListItem entry={mockEntry} />);
    const img = screen.getByAltText('One Piece Vol. 100');
    expect(img).toHaveAttribute('src', 'https://example.com/op100.jpg');
  });

  it('renders placeholder when no cover', () => {
    const noCover = { ...mockEntry, coverImageUrl: null };
    const { container } = render(<CatalogListItem entry={noCover} />);
    // Should have SVG icons (BookOpen placeholder + action buttons)
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('renders star rating', () => {
    render(<CatalogListItem entry={mockEntry} />);
    expect(screen.getByText('5.0')).toBeInTheDocument();
    expect(screen.getByText('(99 avaliacoes)')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<CatalogListItem entry={mockEntry} />);
    expect(screen.getByTitle('Adicionar a colecao')).toBeInTheDocument();
    expect(screen.getByTitle('Favoritar')).toBeInTheDocument();
  });

  it('action buttons stop propagation', () => {
    render(<CatalogListItem entry={mockEntry} />);
    const addBtn = screen.getByTitle('Adicionar a colecao');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    fireEvent(addBtn, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not render author/publisher when null', () => {
    const minimal = { ...mockEntry, author: null, publisher: null };
    render(<CatalogListItem entry={minimal} />);
    expect(screen.queryByText('Autor:')).not.toBeInTheDocument();
    expect(screen.queryByText('Editora:')).not.toBeInTheDocument();
  });
});
