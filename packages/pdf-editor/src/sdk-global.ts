/**
 * Entrada del build IIFE (<script>): expone window.PdfEditorSDK con React incluido e inyecta
 * los estilos del editor la primera vez que se crea uno, para no tener que enlazar CSS.
 */
import css from './PdfEditor.css?inline';
import { createEditor as createEditorBase } from './sdk';
import type { EditorInstance, EditorOptions } from './sdk';

const STYLE_ID = 'jmt-pdf-editor-styles';

function injectStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export function createEditor(element: HTMLElement, options?: EditorOptions): EditorInstance {
  injectStyles();
  return createEditorBase(element, options);
}

export { MESSAGES_EN, MESSAGES_ES } from './i18n';
export { sanitizeHtml, isSafeUrl } from './utils/sanitize';
export type { EditorInstance, EditorOptions, EditorDocument, EditorEvents, EditorTheme } from './sdk';
