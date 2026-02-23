import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CatalogPage from '@/app/[locale]/(public)/catalog/page';
import type { CatalogEntry, CatalogSearchResponse } from '@/lib/api/catalog';

// --- Mocks ---

const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/pt-BR/catalog',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        title: 'Catalogo',
        comics: 'quadrinhos',
        cards: 'Cards',
        list: 'Lista',
        sortByLabel: 'Ordenar por',
        showFilters: 'Filtros',
        hideFilters: 'Ocultar filtros',
        searchPlaceholder: 'Buscar quadrinhos...',
        sortTitle: 'Titulo',
        sortDate: 'Data',
        sortRating: 'Avaliacao',
        noResults: 'Nenhum resultado encontrado',
        clearFilters: 'Limpar filtros',
        filters: 'Filtros',
        activeFilters: 'Filtros ativos',
        previousPage: 'Anterior',
        nextPage: 'Proxima',
        noReviews: 'Sem avaliacoes',
        reviews: 'avaliacoes',
        addToCollection: 'Adicionar a colecao',
        favorite: 'Favoritar',
        trade: 'Trocar',
        'detail.author': 'Autor',
        'detail.publisher': 'Editora',
        releaseDate: 'Data',
        yearFrom: 'De',
        yearTo: 'Ate',
        loading: 'Carregando...',
        error: 'Erro ao carregar',
      };
      if (params && key === 'pageOf') {
        return `Pagina ${params.current} de ${params.total}`;
      }
      return map[key] ?? key;
    };
    return t;
  },
  useLocale: () => 'pt-BR',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockEntries: CatalogEntry[] = [
  {
    id: 'e1',
    title: 'Dragon Ball Vol. 1',
    author: 'Akira Toriyama',
    publisher: 'Panini',
    imprint: null,
    barcode: null,
    isbn: null,
    description: null,
    coverImageUrl: null,
    approvalStatus: 'APPROVED',
    averageRating: 4.8,
    ratingCount: 50,
    volumeNumber: 1,
    editionNumber: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    series: { id: 's1', title: 'Dragon Ball', description: null, totalEditions: 42 },
    categories: [],
    tags: [],
    characters: [],
  },
  {
    id: 'e2',
    title: 'Naruto Vol. 1',
    author: 'Masashi Kishimoto',
    publisher: 'Panini',
    imprint: null,
    barcode: null,
    isbn: null,
    description: null,
    coverImageUrl: null,
    approvalStatus: 'APPROVED',
    averageRating: 4.5,
    ratingCount: 30,
    volumeNumber: 1,
    editionNumber: 1,
    createdAt: '2025-02-01T00:00:00.000Z',
    series: { id: 's2', title: 'Naruto', description: null, totalEditions: 72 },
    categories: [],
    tags: [],
    characters: [],
  },
];

const mockResponse: CatalogSearchResponse = {
  data: mockEntries,
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

const mockSearchCatalog = vi.fn().mockResolvedValue(mockResponse);
const mockGetCategories = vi.fn().mockResolvedValue([]);
const mockGetCharacters = vi.fn().mockResolvedValue({ data: [] });
const mockGetSeries = vi.fn().mockResolvedValue({ data: [] });

vi.mock('@/lib/api/catalog', () => ({
  searchCatalog: (...args: unknown[]) => mockSearchCatalog(...args),
}));

vi.mock('@/lib/api/taxonomy', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  getCharacters: (...args: unknown[]) => mockGetCharacters(...args),
}));

vi.mock('@/lib/api/series', () => ({
  getSeries: (...args: unknown[]) => mockGetSeries(...args),
}));

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchCatalog.mockResolvedValue(mockResponse);
    mockGetCategories.mockResolvedValue([]);
    mockGetCharacters.mockResolvedValue({ data: [] });
    mockGetSeries.mockResolvedValue({ data: [] });
  });

  it('renders the page title', async () => {
    render(<CatalogPage />);
    expect(screen.getByText('Catalogo')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockSearchCatalog.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CatalogPage />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renders catalog entries after loading', async () => {
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Dragon Ball Vol. 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Naruto Vol. 1')).toBeInTheDocument();
  });

  it('shows total count after loading', async () => {
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getAllByText('2 quadrinhos').length).toBeGreaterThan(0);
    });
  });

  it('calls searchCatalog on mount', async () => {
    render(<CatalogPage />);
    await waitFor(() => {
      expect(mockSearchCatalog).toHaveBeenCalled();
    });
  });

  it('calls taxonomy APIs on mount', async () => {
    render(<CatalogPage />);
    await waitFor(() => {
      expect(mockGetCategories).toHaveBeenCalled();
      expect(mockGetCharacters).toHaveBeenCalled();
      expect(mockGetSeries).toHaveBeenCalled();
    });
  });

  it('renders view toggle buttons', () => {
    render(<CatalogPage />);
    expect(screen.getByTitle('Cards')).toBeInTheDocument();
    expect(screen.getByTitle('Lista')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<CatalogPage />);
    expect(screen.getByPlaceholderText('Buscar quadrinhos...')).toBeInTheDocument();
  });

  it('renders sort dropdown trigger', () => {
    render(<CatalogPage />);
    expect(screen.getByText(/Ordenar por/)).toBeInTheDocument();
  });

  it('shows empty state when no results', async () => {
    mockSearchCatalog.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Nenhum resultado encontrado')).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    mockSearchCatalog.mockRejectedValue(new Error('Network error'));
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar')).toBeInTheDocument();
    });
  });

  it('shows clear filters button on empty state', async () => {
    mockSearchCatalog.mockResolvedValue({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Limpar filtros')).toBeInTheDocument();
    });
  });

  it('does not show pagination when single page', async () => {
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Dragon Ball Vol. 1')).toBeInTheDocument();
    });
    expect(screen.queryByText('Anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Proxima')).not.toBeInTheDocument();
  });

  it('shows pagination when multiple pages', async () => {
    mockSearchCatalog.mockResolvedValue({
      data: mockEntries,
      pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
    });
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Anterior')).toBeInTheDocument();
      expect(screen.getByText('Proxima')).toBeInTheDocument();
      expect(screen.getByText('Pagina 1 de 3')).toBeInTheDocument();
    });
  });

  it('previous button is disabled on first page', async () => {
    mockSearchCatalog.mockResolvedValue({
      data: mockEntries,
      pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
    });
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Anterior')).toBeDisabled();
    });
  });

  it('switches to list view when list button is clicked', async () => {
    render(<CatalogPage />);
    await waitFor(() => {
      expect(screen.getByText('Dragon Ball Vol. 1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTitle('Lista'));
    // In list view, entries are still rendered
    expect(screen.getByText('Dragon Ball Vol. 1')).toBeInTheDocument();
  });
});
