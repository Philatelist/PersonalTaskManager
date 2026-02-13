import { useCallback, useEffect, useRef, useState } from "react";

const MIN_CARD_SIZE = 120;
const MAX_CARDS_PER_PAGE = 100;
const DEBOUNCE_MS = 50;

interface GridLayout {
  cols: number;
  cardsPerPage: number;
  containerRef: React.RefCallback<HTMLElement>;
}

export function useGridLayout(): GridLayout {
  const [cols, setCols] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(1);
  const elementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compute = useCallback((el: HTMLElement) => {
    const width = el.clientWidth;
    const height = el.clientHeight;
    const c = Math.max(Math.floor(width / MIN_CARD_SIZE), 1);
    const r = Math.max(Math.floor(height / MIN_CARD_SIZE), 1);
    setCols(c);
    setCardsPerPage(Math.min(c * r, MAX_CARDS_PER_PAGE));
  }, []);

  const containerRef = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      elementRef.current = node;

      if (!node) return;

      // Initial measurement
      compute(node);

      // Observe resize with debounce
      observerRef.current = new ResizeObserver(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (elementRef.current) compute(elementRef.current);
        }, DEBOUNCE_MS);
      });
      observerRef.current.observe(node);
    },
    [compute],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { cols, cardsPerPage, containerRef };
}
