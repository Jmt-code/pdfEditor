import { useCallback, useEffect, useRef, useState, RefObject } from 'react';
import type { DragState } from '../types';

const EMPTY: DragState = { isDragging: false, startX: 0, startY: 0, selection: '' };

/** Mueve la selección conservando sus nodos y formatos. */
export function useDragAndDrop(editorRef: RefObject<HTMLDivElement | null>, disabled = false) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const source = useRef<Range | null>(null);
  const [dragState, setDragState] = useState<DragState>(EMPTY);
  const active = useRef(false);
  const handlePointerCancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    source.current = null;
    active.current = false;
    setDragState(EMPTY);
    document.body.style.cursor = '';
  }, []);
  useEffect(() => {
    if (disabled) handlePointerCancel();
    return handlePointerCancel;
  }, [disabled, handlePointerCancel]);
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    handlePointerCancel();
    const selection = window.getSelection();
    if (disabled || !selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;
    source.current = range.cloneRange();
    const { clientX, clientY } = event;
    timer.current = setTimeout(() => {
      active.current = true;
      setDragState({ isDragging: true, startX: clientX, startY: clientY, selection: selection.toString() });
      document.body.style.cursor = 'grabbing';
    }, 500);
  }, [disabled, editorRef, handlePointerCancel]);
  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    const original = source.current;
    const drop = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (!disabled && active.current && original && drop && editorRef.current?.contains(original.commonAncestorContainer) && editorRef.current.contains(drop.startContainer) && !original.isPointInRange(drop.startContainer, drop.startOffset)) {
      const fragment = original.extractContents();
      const last = fragment.lastChild;
      drop.insertNode(fragment);
      if (last) {
        drop.setStartAfter(last);
        drop.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(drop);
      }
      editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
    handlePointerCancel();
  }, [disabled, editorRef, handlePointerCancel]);
  return { dragState, getDragState: () => dragState, handlePointerDown, handlePointerUp, handlePointerCancel };
}
