'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import { getCart, getCartSummary, type CartItem } from '@/lib/api/cart';

interface CartContextType {
  cartCount: number;
  cartItems: CartItem[];
  isLoading: boolean;
  refreshCart: () => Promise<void>;
  incrementCount: () => void;
  decrementCount: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize cart count on mount when user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setCartCount(0);
      setCartItems([]);
      return;
    }

    let cancelled = false;

    async function fetchSummary() {
      try {
        const summary = await getCartSummary();
        if (!cancelled) {
          setCartCount(summary.itemCount);
        }
      } catch {
        // Silently fail — cart summary is non-critical
      }
    }

    fetchSummary();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const items = await getCart();
      setCartItems(items);
      setCartCount(items.length);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const incrementCount = useCallback(() => {
    setCartCount((prev) => prev + 1);
  }, []);

  const decrementCount = useCallback(() => {
    setCartCount((prev) => Math.max(0, prev - 1));
  }, []);

  const value: CartContextType = useMemo(
    () => ({
      cartCount,
      cartItems,
      isLoading,
      refreshCart,
      incrementCount,
      decrementCount,
    }),
    [cartCount, cartItems, isLoading, refreshCart, incrementCount, decrementCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider.');
  }
  return context;
}
