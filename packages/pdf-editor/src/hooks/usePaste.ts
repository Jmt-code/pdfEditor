import { useCallback, useRef, RefObject } from 'react';
import { isSafeUrl, sanitizePastedHtml, escapeHtml } from '../utils/sanitize';
import { isAllowedImageFile, readImageFile } from '../utils/images';

/** Texto plano → HTML conservando sangrías y espacios repetidos (código, columnas) */
function plainTextToHtml(text: string): string {
  const escaped = escapeHtml(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    // Espacios iniciales y repetidos alternando &nbsp; para que no se colapsen
    .replace(/^ +| {2,}/gm, (spaces) => spaces.replace(/ /g, ' '));
  const paragraphs = escaped.split('\n\n').map((paragraph) => paragraph.replace(/\n/g, '<br>'));
  return paragraphs.length > 1 ? paragraphs.map((paragraph) => `<p>${paragraph || '<br>'}</p>`).join('') : paragraphs[0];
}

export function usePaste(editorRef: RefObject<HTMLDivElement | null>, options: { disabled?: boolean; onPasted?: () => void }) {
  const { disabled, onPasted } = options;
  /**
   * true mientras se inserta contenido pegado: el evento `input` que dispara la inserción no
   * debe procesarse como escritura (atajos Markdown, doble notificación).
   */
  const pastingRef = useRef(false);
  /** Inserta el contenido de un portapapeles o de un arrastre externo en `range` (saneado) */
  const insertData = useCallback((data: DataTransfer, range: Range) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (disabled || !editor || !selection || !editor.contains(range.commonAncestorContainer)) return;

    /** Inserta en `target` y devuelve el punto justo detrás de lo insertado (para encadenar) */
    const insert = (html: string, target: Range): Range => {
      if (!html || editorRef.current !== editor || !editor.isConnected || !editor.contains(target.commonAncestorContainer)) return target;
      selection.removeAllRanges();
      selection.addRange(target);
      let inserted = false;
      pastingRef.current = true;
      try {
        try {
          inserted = document.execCommand?.('insertHTML', false, html) ?? false;
        } catch {
          // Algunos navegadores no implementan este comando.
        }
        if (!inserted) {
          const template = document.createElement('template');
          template.innerHTML = html;
          const last = template.content.lastChild;
          if (!last) return target;
          target.deleteContents();
          target.insertNode(template.content);
          target.setStartAfter(last);
          target.collapse(true);
          selection.removeAllRanges();
          selection.addRange(target);
        }
      } finally {
        pastingRef.current = false;
      }
      // Una sola notificación por pegado (el input de la inserción se ignora)
      onPasted?.();
      const after = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : target;
      return editor.contains(after.commonAncestorContainer) ? after : target;
    };

    /** Lee e inserta imágenes en orden, cada una detrás de la anterior */
    const insertImages = (files: File[], start: Range) => {
      void (async () => {
        let caret = start;
        for (const file of files) {
          const url = await readImageFile(file);
          if (url && isSafeUrl(url, 'image')) caret = insert(`<img src="${url}">`, caret);
        }
      })();
    };

    const files = Array.from(data.files).filter(isAllowedImageFile);
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    if (html) {
      // Word/Office referencian sus imágenes con file:// o cid: (se eliminan al sanear) y
      // ponen los bytes reales en clipboardData.files: se insertan esas imágenes en su lugar
      const template = document.createElement('template');
      template.innerHTML = sanitizePastedHtml(html);
      const brokenImages = template.content.querySelectorAll('img:not([src])');
      brokenImages.forEach((img) => img.remove());
      const cleaned = template.innerHTML;
      if (!template.content.textContent?.trim() && !template.content.querySelector('img, table, hr')) {
        // Nada aprovechable en el HTML (p. ej. texto dentro de <svg>): pegar el texto plano
        const caret = text ? insert(plainTextToHtml(text), range) : range;
        if (files.length) insertImages(files, caret);
      } else {
        const caret = insert(cleaned, range);
        if (files.length && brokenImages.length) insertImages(files, caret);
      }
    } else if (text) {
      insert(plainTextToHtml(text), range);
    } else if (files.length) {
      insertImages(files, range);
    }
  }, [disabled, editorRef, onPasted]);

  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    event.preventDefault();
    const selection = window.getSelection();
    if (disabled || !selection?.rangeCount) return;
    insertData(event.clipboardData, selection.getRangeAt(0).cloneRange());
  }, [disabled, insertData]);

  /**
   * Arrastres que empiezan dentro del editor (mover texto) son nativos; lo que llega de fuera
   * (otra web, el escritorio) se sanea igual que al pegar, en el punto donde se suelta.
   */
  const internalDrag = useRef(false);
  const handleDragStart = useCallback(() => {
    internalDrag.current = true;
  }, []);
  const handleDragEnd = useCallback(() => {
    internalDrag.current = false;
  }, []);
  const handleDrop = useCallback((event: React.DragEvent) => {
    if (internalDrag.current) {
      internalDrag.current = false;
      if (disabled) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (disabled) return;
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(event.clientX, event.clientY);
    } else if (doc.caretPositionFromPoint) {
      const pos = doc.caretPositionFromPoint(event.clientX, event.clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (range) insertData(event.dataTransfer, range);
  }, [disabled, insertData]);
  return { handlePaste, handleDrop, handleDragStart, handleDragEnd, pastingRef };
}
