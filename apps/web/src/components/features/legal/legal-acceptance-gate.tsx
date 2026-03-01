'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/auth/use-auth';
import { getPendingAcceptances, type LegalDocument } from '@/lib/api/legal';
import { LegalAcceptanceModal } from './legal-acceptance-modal';

interface LegalAcceptanceGateProps {
  children: React.ReactNode;
}

export function LegalAcceptanceGate({ children }: LegalAcceptanceGateProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [pendingDocs, setPendingDocs] = useState<LegalDocument[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const fetchPending = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const docs = await getPendingAcceptances();
      setPendingDocs(docs);
      setCurrentIndex(0);
    } catch {
      // If we fail to check, allow access — don't block on network errors
      setPendingDocs([]);
    } finally {
      setIsLoading(false);
      setChecked(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchPending();
    } else if (!authLoading && !isAuthenticated) {
      setChecked(true);
    }
  }, [authLoading, isAuthenticated, fetchPending]);

  function handleAccepted() {
    const nextIndex = currentIndex + 1;
    if (nextIndex < pendingDocs.length) {
      setCurrentIndex(nextIndex);
    } else {
      // All documents accepted
      setPendingDocs([]);
      setCurrentIndex(0);
    }
  }

  // Still loading auth or checking pending docs
  if (authLoading || (isAuthenticated && !checked)) {
    return null; // Don't render anything while checking — layout handles loading
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If there are pending documents, show modal
  if (pendingDocs.length > 0 && currentIndex < pendingDocs.length) {
    const currentDoc = pendingDocs[currentIndex];
    return (
      <>
        {children}
        <LegalAcceptanceModal
          document={currentDoc}
          open={true}
          onAccepted={handleAccepted}
        />
      </>
    );
  }

  return <>{children}</>;
}
