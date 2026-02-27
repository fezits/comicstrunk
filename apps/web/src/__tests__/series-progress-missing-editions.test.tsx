import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-intl
const translationMap: Record<string, string | ((...args: unknown[]) => string)> = {
  collected: 'collected',
  noMissing: 'Completa!',
  showMissing: 'Mostrar faltantes',
  hideMissing: 'Ocultar faltantes',
  missingEditions: 'Edições faltantes',
  searchInCatalog: 'Buscar no catálogo',
  edition: 'Ed.',
  volume: 'Vol.',
};

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const val = translationMap[key];
    if (typeof val === 'function') return val(params);
    if (params && typeof val === 'string') {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(`{${k}}`, String(v)),
        val,
      );
    }
    return val ?? key;
  },
  useLocale: () => 'pt-BR',
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock the collection API
const mockGetMissingEditions = vi.fn();

vi.mock('@/lib/api/collection', () => ({
  getMissingEditions: (...args: unknown[]) => mockGetMissingEditions(...args),
}));

// Mock UI components that are hard to render in test
vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => (
    <div role="progressbar" aria-valuenow={value} data-testid="progress-bar" />
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    asChild,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => {
    if (asChild) {
      // For asChild, just render the children directly
      return <>{children}</>;
    }
    return (
      <button onClick={onClick} {...props}>
        {children}
      </button>
    );
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

import { SeriesProgressCard } from '@/components/features/collection/series-progress-card';
import type { SeriesProgressItem } from '@/lib/api/collection';

describe('SeriesProgressCard — missing editions panel (SERI-07)', () => {
  const incompleteProgress: SeriesProgressItem = {
    seriesId: 'series-abc',
    seriesTitle: 'Dragon Ball',
    totalEditions: 42,
    collected: 15,
    percentage: 35.7,
  };

  const completeProgress: SeriesProgressItem = {
    seriesId: 'series-def',
    seriesTitle: 'One Punch Man',
    totalEditions: 10,
    collected: 10,
    percentage: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Show missing (N)" button for incomplete series', () => {
    render(<SeriesProgressCard progress={incompleteProgress} />);

    // Should show the toggle button with missing count (text split across elements)
    const toggleBtn = screen.getByText(/Mostrar faltantes/).closest('button')!;
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn.textContent).toContain('27');
  });

  it('shows "Complete" for fully collected series instead of toggle', () => {
    render(<SeriesProgressCard progress={completeProgress} />);

    expect(screen.getByText('Completa!')).toBeInTheDocument();
    expect(screen.queryByText(/Mostrar faltantes/)).not.toBeInTheDocument();
  });

  it('fetches and renders missing editions when expanded', async () => {
    const user = userEvent.setup();

    const mockEditions = [
      {
        id: 'ed-1',
        title: 'Dragon Ball Vol. 5',
        editionNumber: 5,
        volumeNumber: null,
        coverImageUrl: 'https://example.com/cover5.jpg',
      },
      {
        id: 'ed-2',
        title: 'Dragon Ball Vol. 12',
        editionNumber: 12,
        volumeNumber: null,
        coverImageUrl: null,
      },
      {
        id: 'ed-3',
        title: 'Dragon Ball Vol. 30',
        editionNumber: 30,
        volumeNumber: 3,
        coverImageUrl: 'https://example.com/cover30.jpg',
      },
    ];

    mockGetMissingEditions.mockResolvedValueOnce(mockEditions);

    render(<SeriesProgressCard progress={incompleteProgress} />);

    // Click "Show missing"
    const toggleBtn = screen.getByText(/Mostrar faltantes/).closest('button')!;
    await user.click(toggleBtn);

    // Wait for editions to load (skeletons may flash too fast to catch)
    await waitFor(() => {
      expect(screen.getByText('Dragon Ball Vol. 5')).toBeInTheDocument();
    });

    // Verify all editions rendered
    expect(screen.getByText('Dragon Ball Vol. 5')).toBeInTheDocument();
    expect(screen.getByText('Dragon Ball Vol. 12')).toBeInTheDocument();
    expect(screen.getByText('Dragon Ball Vol. 30')).toBeInTheDocument();

    // Verify links point to /catalog/:id
    const link1 = screen.getByText('Dragon Ball Vol. 5').closest('a');
    expect(link1).toHaveAttribute('href', '/pt-BR/catalog/ed-1');

    const link2 = screen.getByText('Dragon Ball Vol. 12').closest('a');
    expect(link2).toHaveAttribute('href', '/pt-BR/catalog/ed-2');

    const link3 = screen.getByText('Dragon Ball Vol. 30').closest('a');
    expect(link3).toHaveAttribute('href', '/pt-BR/catalog/ed-3');

    // Verify "Search in catalog" link
    const searchLink = screen.getByText('Buscar no catálogo').closest('a');
    expect(searchLink).toHaveAttribute('href', '/pt-BR/catalog?seriesId=series-abc');

    // Verify API was called with the right seriesId
    expect(mockGetMissingEditions).toHaveBeenCalledWith('series-abc');
  });

  it('calls getMissingEditions only once even when toggled multiple times', async () => {
    const user = userEvent.setup();

    mockGetMissingEditions.mockResolvedValueOnce([
      {
        id: 'ed-1',
        title: 'Edition 1',
        editionNumber: 1,
        volumeNumber: null,
        coverImageUrl: null,
      },
    ]);

    render(<SeriesProgressCard progress={incompleteProgress} />);

    const toggleBtn = screen.getByText(/Mostrar faltantes/).closest('button')!;

    // First expand
    await user.click(toggleBtn);
    await waitFor(() => {
      expect(screen.getByText('Edition 1')).toBeInTheDocument();
    });

    // Collapse
    const hideBtn = screen.getByText(/Ocultar faltantes/).closest('button')!;
    await user.click(hideBtn);

    // Re-expand — should NOT call API again
    const toggleBtn2 = screen.getByText(/Mostrar faltantes/).closest('button')!;
    await user.click(toggleBtn2);

    await waitFor(() => {
      expect(screen.getByText('Edition 1')).toBeInTheDocument();
    });

    // API should have been called exactly once
    expect(mockGetMissingEditions).toHaveBeenCalledTimes(1);
  });

  it('shows series title, collected count, and progress bar', () => {
    render(<SeriesProgressCard progress={incompleteProgress} />);

    expect(screen.getByText('Dragon Ball')).toBeInTheDocument();
    expect(screen.getByText('15/42')).toBeInTheDocument();

    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '35.7');
  });
});
