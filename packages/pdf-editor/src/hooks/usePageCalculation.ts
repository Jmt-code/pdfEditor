import { useState, useCallback, useEffect, useRef, RefObject } from 'react';
import { getContentHeightPerPage } from '../types';
import { collectLayout, paginate } from '../utils/htmlLayout';

const RECALCULATE_DELAY_MS = 120;

/**
 * Hook para calcular el número de páginas con el mismo algoritmo que usa la exportación a PDF,
 * de modo que el contador del editor coincide con las páginas del PDF.
 */
export function usePageCalculation(
  editorRef: RefObject<HTMLDivElement | null>,
  hasHeader: boolean,
  hasFooter: boolean
) {
  const [pageCount, setPageCount] = useState(1);
  const [pageBreaks, setPageBreaks] = useState<number[]>([0]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculateNow = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    // Sin decoraciones: solo mide, no inserta sondas en el DOM editable
    const layout = collectLayout(el, { decorations: false });
    const breaks = paginate(layout, getContentHeightPerPage(hasHeader, hasFooter));
    setPageCount(prev => (prev !== breaks.length ? breaks.length : prev));
    setPageBreaks(prev =>
      prev.length === breaks.length && prev.every((b, i) => Math.abs(b - breaks[i]) < 0.5) ? prev : breaks
    );
  }, [editorRef, hasHeader, hasFooter]);

  const recalculate = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      calculateNow();
    }, RECALCULATE_DELAY_MS);
  }, [calculateNow]);

  // Recalcular cuando cambian cabecera/pie
  useEffect(() => {
    calculateNow();
  }, [calculateNow]);

  // Observer para cambios de tamaño (imágenes que cargan, fuentes, ancho de ventana)
  useEffect(() => {
    const el = editorRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => recalculate());
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editorRef, recalculate]);

  return {
    pageCount,
    /** Inicio de cada página, en px desde el borde superior del contenido del editor */
    pageBreaks,
    recalculate,
  };
}
