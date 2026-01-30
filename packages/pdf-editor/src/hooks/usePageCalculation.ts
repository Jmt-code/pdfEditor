import { useState, useCallback, useEffect, RefObject } from 'react';
import { PAGE_DIMENSIONS, getContentHeightPerPage } from '../types';

/**
 * Hook para calcular el número de páginas basado en el contenido
 */
export function usePageCalculation(
  editorRef: RefObject<HTMLDivElement | null>,
  hasHeader: boolean,
  hasFooter: boolean
) {
  const [pageCount, setPageCount] = useState(1);

  const calculatePageCount = useCallback(() => {
    if (!editorRef.current) return;
    
    const contentHeight = editorRef.current.scrollHeight;
    // Altura disponible por página (sin padding, el padding ya está en el elemento)
    const availableHeightPerPage = getContentHeightPerPage(hasHeader, hasFooter) + (PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX * 2);
    
    const calculatedPages = Math.max(1, Math.ceil(contentHeight / availableHeightPerPage));
    setPageCount(prev => prev !== calculatedPages ? calculatedPages : prev);
  }, [editorRef, hasHeader, hasFooter]);

  // Recalcular cuando cambia el contenido
  useEffect(() => {
    calculatePageCount();
  }, [calculatePageCount]);

  // Observer para cambios en el contenido
  useEffect(() => {
    if (!editorRef.current) return;

    const observer = new ResizeObserver(() => {
      calculatePageCount();
    });

    observer.observe(editorRef.current);

    return () => {
      observer.disconnect();
    };
  }, [editorRef, calculatePageCount]);

  return {
    pageCount,
    recalculate: calculatePageCount,
  };
}
