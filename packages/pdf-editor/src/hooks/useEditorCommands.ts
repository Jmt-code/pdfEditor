import { useCallback, useEffect, useRef, RefObject } from 'react';
import { isSafeUrl, sanitizeHtml } from '../utils/sanitize';
import { ALLOWED_IMAGE_TYPES, readImageFile } from '../utils/images';
import type { TextFormat } from '../types';

/**
 * Hook para manejar los comandos del editor
 */
const FORMAT_COMMANDS: [string, TextFormat][] = [
  ['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline'], ['strikeThrough', 'strikethrough'],
  ['insertUnorderedList', 'ul'], ['insertOrderedList', 'ol'],
  ['justifyLeft', 'left'], ['justifyCenter', 'center'], ['justifyRight', 'right'], ['justifyFull', 'justify'],
];

/** Formatos activos en la selección actual (fuente única para la barra y los eventos) */
export function readActiveFormats(): TextFormat[] {
  return FORMAT_COMMANDS.filter(([command]) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }).map(([, format]) => format);
}

export function useEditorCommands(
  editorRef: RefObject<HTMLDivElement | null>,
  onFormatsChange: (formats: Set<TextFormat>) => void,
  onContentChange?: () => void,
  disabled = false,
  prompts: { link: string; image: string } = { link: 'Enter URL:', image: 'Enter image URL:' }
) {
  const promptsRef = useRef(prompts);
  promptsRef.current = prompts;
  const savedRange = useRef<Range | null>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  useEffect(() => {
    const editor = editorRef.current;
    const save = () => {
      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (editor?.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
      }
    };
    document.addEventListener('selectionchange', save);
    editor?.addEventListener('blur', save);
    return () => {
      document.removeEventListener('selectionchange', save);
      editor?.removeEventListener('blur', save);
    };
  }, [editorRef]);
  /**
   * Actualiza los formatos activos basándose en la selección actual
   */
  const updateActiveFormats = useCallback(() => {
    onFormatsChange(new Set(readActiveFormats()));
  }, [onFormatsChange]);

  /**
   * Ejecuta un comando del editor
   */
  const execCommand = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (disabledRef.current || !editor) return;
    // execCommand no distingue mayúsculas: se normaliza antes de validar
    const name = command.toLowerCase();
    if (name === 'createlink' && (!value || !isSafeUrl(value, 'link'))) return;
    if (name === 'insertimage' && (!value || !isSafeUrl(value, 'image'))) return;
    // El HTML insertado por la API pasa por el mismo saneado que setHTML
    if (name === 'inserthtml') {
      value = sanitizeHtml(value ?? '');
      if (!value) return;
    }
    const selection = window.getSelection();
    if (!selection) return;
    const current = selection.rangeCount ? selection.getRangeAt(0) : null;
    const range = current && editor.contains(current.commonAncestorContainer)
      ? current.cloneRange()
      : savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)
        ? savedRange.current.cloneRange() : document.createRange();
    if (!editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    editor.focus();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand(command, false, value);
    if (selection.rangeCount) savedRange.current = selection.getRangeAt(0).cloneRange();
    updateActiveFormats();
    
    // Notificar cambio de contenido
    if (onContentChange) {
      setTimeout(onContentChange, 0);
    }
  }, [editorRef, updateActiveFormats, onContentChange]);

  /**
   * Formatea un bloque (h1, h2, p, etc.)
   */
  const formatBlock = useCallback((tag: string) => {
    execCommand('formatBlock', tag);
  }, [execCommand]);

  /**
   * Inserta un enlace
   */
  const insertLink = useCallback(() => {
    if (disabledRef.current) return;
    const url = prompt(promptsRef.current.link);
    if (url && isSafeUrl(url, 'link')) {
      execCommand('createLink', url);
    }
  }, [execCommand]);

  /**
   * Inserta una imagen
   */
  const insertImage = useCallback(() => {
    if (disabledRef.current) return;
    const url = prompt(promptsRef.current.image);
    if (url && isSafeUrl(url, 'image')) {
      execCommand('insertImage', url);
    }
  }, [execCommand]);

  /**
   * Inserta una imagen desde un archivo
   */
  const insertImageFromFile = useCallback(() => {
    if (disabledRef.current) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ALLOWED_IMAGE_TYPES.join(',');
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      const dataUrl = file ? await readImageFile(file) : null;
      if (dataUrl && isSafeUrl(dataUrl, 'image')) execCommand('insertImage', dataUrl);
    };
    input.click();
  }, [execCommand]);

  /**
   * Inserta una tabla vacía de filas × columnas (HTML fijo, sin texto del usuario) con la
   * primera fila como cabecera. Usa insertHTML para conservar el deshacer nativo.
   */
  const insertTable = useCallback((rows = 3, cols = 3) => {
    const r = Math.min(50, Math.max(1, Math.floor(rows)));
    const c = Math.min(20, Math.max(1, Math.floor(cols)));
    const cell = (tag: 'th' | 'td') => `<${tag}><br></${tag}>`;
    const head = `<tr>${cell('th').repeat(c)}</tr>`;
    const body = `<tr>${cell('td').repeat(c)}</tr>`.repeat(Math.max(0, r - 1));
    execCommand('insertHTML', `<table><thead>${head}</thead><tbody>${body}</tbody></table><p><br></p>`);
  }, [execCommand]);

  /** Inserta un salto de página manual (afecta al PDF y al contador de páginas). */
  const insertPageBreak = useCallback(() => {
    const editor = editorRef.current;
    if (disabledRef.current || !editor) return;
    const existing = new Set(editor.querySelectorAll('[data-page-break]'));
    // ¿El cursor está en mitad de un bloque? Entonces, como en Word, el texto que queda detrás
    // del cursor pasa a la página siguiente y el cursor se queda delante de él.
    let splitsBlock = false;
    const sel = window.getSelection();
    if (sel?.rangeCount && editor.contains(sel.anchorNode)) {
      const caret = sel.getRangeAt(0);
      const start = caret.endContainer;
      const block = (start.nodeType === Node.ELEMENT_NODE ? start as Element : start.parentElement)
        ?.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div');
      if (block && block !== editor && editor.contains(block)) {
        const tail = document.createRange();
        tail.setStart(caret.endContainer, caret.endOffset);
        tail.setEnd(block, block.childNodes.length);
        splitsBlock = tail.toString().length > 0;
      }
    }
    execCommand('insertHTML', '<div data-page-break="true"></div><p><br></p>');
    const marker = Array.from(editor.querySelectorAll('[data-page-break]')).find((m) => !existing.has(m));
    if (!marker) return;

    // Chrome, al insertar en un párrafo vacío (p. ej. tras una tabla), deja el cursor y el
    // párrafo delante del salto y descarta el de detrás: lo que se escriba debe ir después.
    const isEmptyBlock = (el: Element | null): el is HTMLElement =>
      !!el && /^(P|DIV|H[1-6])$/.test(el.tagName) && !el.hasAttribute('data-page-break') &&
      !el.textContent && !el.querySelector('img, table, hr');
    let next = marker.nextElementSibling;
    if (splitsBlock && isEmptyBlock(next) && next.nextElementSibling) {
      const rest = next.nextElementSibling;
      next.remove();
      next = rest;
    } else if (!isEmptyBlock(next)) {
      next = document.createElement('p');
      next.appendChild(document.createElement('br'));
      marker.after(next);
    }
    const prev = marker.previousElementSibling;
    if (isEmptyBlock(prev)) prev.remove();

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(next, 0);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRange.current = range.cloneRange();
  }, [editorRef, execCommand]);

  return {
    execCommand,
    formatBlock,
    insertLink,
    insertImage,
    insertImageFromFile,
    insertTable,
    insertPageBreak,
    updateActiveFormats,
  };
}
