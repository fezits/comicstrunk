import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-intl
const mockTranslations: Record<string, string> = {
  addSuccess: 'Item adicionado!',
  addError: 'Erro ao adicionar item',
  addItem: 'Adicionar item',
  planLimitMessage: 'Limite do plano atingido',
  planLimitUpgrade:
    'Voce atingiu o limite de itens do seu plano. Faca upgrade para o plano BASIC para adicionar ate 200 itens.',
  importError: 'Erro ao importar',
  searchCatalog: 'Buscar no catálogo',
  searchCatalogPlaceholder: 'Buscar...',
  title: 'Coleção',
  noSearchResults: 'Nenhum resultado',
  changeEntry: 'Alterar',
  'form.quantity': 'Quantidade',
  'form.pricePaid': 'Preço pago',
  'form.condition': 'Condição',
  'form.notes': 'Notas',
  'form.notesPlaceholder': 'Notas...',
  'form.isRead': 'Já li',
  'condition.NEW': 'Novo',
  'condition.VERY_GOOD': 'Muito bom',
  'condition.GOOD': 'Bom',
  'condition.FAIR': 'Regular',
  'condition.POOR': 'Ruim',
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => mockTranslations[key] ?? key,
  useLocale: () => 'pt-BR',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Track toast calls
const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
  },
}));

// Mock collection API
const mockAddCollectionItem = vi.fn();
const mockImportCollection = vi.fn();
const mockGetCSVTemplate = vi.fn();

vi.mock('@/lib/api/collection', () => ({
  addCollectionItem: (...args: unknown[]) => mockAddCollectionItem(...args),
  importCollection: (...args: unknown[]) => mockImportCollection(...args),
  getCSVTemplate: (...args: unknown[]) => mockGetCSVTemplate(...args),
}));

vi.mock('@/lib/api/catalog', () => ({
  searchCatalog: vi.fn().mockResolvedValue({ data: [] }),
}));

// We need to import the component AFTER mocks are set up
import AddCollectionItemPage from '@/app/[locale]/(collector)/collection/add/page';

describe('AddCollectionItemPage — plan limit error handling (COLL-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows specific plan limit toast when API returns 400 with "Collection limit reached"', async () => {
    const user = userEvent.setup();

    // Simulate 400 plan limit error from API
    mockAddCollectionItem.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: {
            message: 'Collection limit reached (50 items for FREE plan)',
          },
        },
      },
    });

    render(<AddCollectionItemPage />);

    // Search and select an entry to show the form
    const searchInput = screen.getByPlaceholderText('Buscar...');
    await user.type(searchInput, 'test');

    // We need to trigger catalog search mock to return results
    const { searchCatalog } = await import('@/lib/api/catalog');
    (searchCatalog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        {
          id: 'cat-1',
          title: 'Test Comic #1',
          coverImageUrl: null,
          author: 'Author',
          publisher: 'Publisher',
          series: null,
        },
      ],
    });

    // Re-trigger search to get mock result
    await user.clear(searchInput);
    await user.type(searchInput, 'comic');

    // Wait for debounced search results
    await waitFor(
      () => {
        expect(screen.getByText('Test Comic #1')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Select the entry
    await user.click(screen.getByText('Test Comic #1'));

    // Submit the form
    const addButton = screen.getByRole('button', { name: 'Adicionar item' });
    await user.click(addButton);

    // Verify plan limit toast is shown, NOT the generic error
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Limite do plano atingido', {
        description:
          'Voce atingiu o limite de itens do seu plano. Faca upgrade para o plano BASIC para adicionar ate 200 itens.',
        duration: 8000,
      });
    });

    // Ensure generic error was NOT called
    expect(toastError).not.toHaveBeenCalledWith('Erro ao adicionar item');
  });

  it('shows generic error toast for non-plan-limit 400 errors', async () => {
    const user = userEvent.setup();

    // Simulate generic 400 error
    mockAddCollectionItem.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: {
            message: 'Catalog entry not found',
          },
        },
      },
    });

    render(<AddCollectionItemPage />);

    // Set up catalog search mock
    const { searchCatalog } = await import('@/lib/api/catalog');
    (searchCatalog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        {
          id: 'cat-2',
          title: 'Another Comic',
          coverImageUrl: null,
          author: 'Author',
          publisher: 'Publisher',
          series: null,
        },
      ],
    });

    const searchInput = screen.getByPlaceholderText('Buscar...');
    await user.type(searchInput, 'another');

    await waitFor(
      () => {
        expect(screen.getByText('Another Comic')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    await user.click(screen.getByText('Another Comic'));

    const addButton = screen.getByRole('button', { name: 'Adicionar item' });
    await user.click(addButton);

    // Should show generic error, not plan limit
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Erro ao adicionar item');
    });

    // Plan limit toast should NOT have been called
    expect(toastError).not.toHaveBeenCalledWith(
      'Limite do plano atingido',
      expect.anything(),
    );
  });

  it('shows generic error toast for network errors (no response)', async () => {
    const user = userEvent.setup();

    // Simulate network error — no response object
    mockAddCollectionItem.mockRejectedValueOnce(new Error('Network Error'));

    render(<AddCollectionItemPage />);

    const { searchCatalog } = await import('@/lib/api/catalog');
    (searchCatalog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [
        {
          id: 'cat-3',
          title: 'Net Error Comic',
          coverImageUrl: null,
          author: 'Author',
          publisher: 'Publisher',
          series: null,
        },
      ],
    });

    const searchInput = screen.getByPlaceholderText('Buscar...');
    await user.type(searchInput, 'net');

    await waitFor(
      () => {
        expect(screen.getByText('Net Error Comic')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    await user.click(screen.getByText('Net Error Comic'));

    const addButton = screen.getByRole('button', { name: 'Adicionar item' });
    await user.click(addButton);

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('Erro ao adicionar item');
    });
  });
});
