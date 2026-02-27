import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarRating } from '@/components/features/catalog/star-rating';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      noReviews: 'Sem avaliacoes',
      reviews: 'avaliacoes',
    };
    return map[key] ?? key;
  },
}));

describe('StarRating', () => {
  it('renders 5 empty stars and "Sem avaliacoes" when count is 0', () => {
    render(<StarRating rating={0} count={0} />);
    expect(screen.getByText('Sem avaliacoes')).toBeInTheDocument();
  });

  it('renders rating number and review count when count > 0', () => {
    render(<StarRating rating={4.5} count={12} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(12 avaliacoes)')).toBeInTheDocument();
  });

  it('renders integer rating correctly', () => {
    render(<StarRating rating={3} count={5} />);
    expect(screen.getByText('3.0')).toBeInTheDocument();
    expect(screen.getByText('(5 avaliacoes)')).toBeInTheDocument();
  });

  it('renders with size sm', () => {
    const { container } = render(<StarRating rating={0} count={0} size="sm" />);
    const stars = container.querySelectorAll('svg');
    expect(stars.length).toBe(5);
  });

  it('renders with size lg', () => {
    const { container } = render(<StarRating rating={0} count={0} size="lg" />);
    const stars = container.querySelectorAll('svg');
    expect(stars.length).toBe(5);
  });

  it('renders 5 star SVGs for a 5-star rating', () => {
    const { container } = render(<StarRating rating={5} count={10} />);
    const stars = container.querySelectorAll('svg');
    expect(stars.length).toBe(5);
  });
});
