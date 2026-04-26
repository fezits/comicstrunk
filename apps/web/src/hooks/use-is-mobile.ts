'use client';

import { useEffect, useState } from 'react';

/**
 * Detect if the current viewport is mobile-sized (< 768px).
 * Used to differentiate UX patterns (e.g., debounced vs. enter-only search).
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}
