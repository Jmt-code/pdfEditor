import { useCallback, useRef, RefObject } from 'react';
import type { DragState } from '../types';

const LONG_PRESS_DURATION = 500;

/**
 * Hook para manejar drag and drop de texto
 */
export function useDragAndDrop(editorRef: RefObject<HTMLDivElement | null>) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStateRef = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    selection: '',
  });

  const getDragState = useCallback(() => dragStateRef.current, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const selectedText = selection.toString();
    if (!selectedText.trim()) return;

    longPressTimer.current = setTimeout(() => {
      dragStateRef.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        selection: selectedText,
      };
      document.body.style.cursor = 'grabbing';
    }, LONG_PRESS_DURATION);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const dragState = dragStateRef.current;
    if (!dragState.isDragging || !editorRef.current) {
      dragStateRef.current = { isDragging: false, startX: 0, startY: 0, selection: '' };
      document.body.style.cursor = '';
      return;
    }

    // Get drop position
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range && editorRef.current.contains(range.startContainer)) {
      // Delete original selection
      const selection = window.getSelection();
      if (selection) {
        selection.deleteFromDocument();
      }
      
      // Insert at new position
      range.insertNode(document.createTextNode(dragState.selection));
    }

    dragStateRef.current = { isDragging: false, startX: 0, startY: 0, selection: '' };
    document.body.style.cursor = '';
  }, [editorRef]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    dragStateRef.current = { isDragging: false, startX: 0, startY: 0, selection: '' };
    document.body.style.cursor = '';
  }, []);

  return {
    getDragState,
    handlePointerDown,
    handlePointerUp,
    handlePointerCancel,
  };
}
