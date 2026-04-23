'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import { getCollectionStats } from '@/lib/api/collection';

interface CollectionContextType {
  collectionCount: number;
  refreshCount: () => Promise<void>;
  incrementCount: (amount?: number) => void;
  decrementCount: (amount?: number) => void;
}

const CollectionContext = createContext<CollectionContextType | null>(null);

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [collectionCount, setCollectionCount] = useState(0);

  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const stats = await getCollectionStats();
      setCollectionCount(stats.totalItems ?? 0);
    } catch {
      // silent
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setCollectionCount(0);
      return;
    }
    refreshCount();
  }, [isAuthenticated, authLoading, refreshCount]);

  const incrementCount = useCallback((amount = 1) => {
    setCollectionCount(prev => prev + amount);
  }, []);

  const decrementCount = useCallback((amount = 1) => {
    setCollectionCount(prev => Math.max(0, prev - amount));
  }, []);

  const value = useMemo(
    () => ({ collectionCount, refreshCount, incrementCount, decrementCount }),
    [collectionCount, refreshCount, incrementCount, decrementCount],
  );

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used inside CollectionProvider');
  return ctx;
}
