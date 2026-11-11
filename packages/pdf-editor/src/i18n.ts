/**
 * Textos de la interfaz del editor. Las claves son estables: forman parte de la API pública
 * (opción `messages`), así que no deben renombrarse.
 */
export interface EditorMessages {
  toolbarLabel: string;
  blockFormat: string;
  fontFamily: string;
  fontSize: string;
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  textColor: string;
  highlightColor: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  justify: string;
  bulletList: string;
  numberedList: string;
  decreaseIndent: string;
  increaseIndent: string;
  insertLink: string;
  insertImage: string;
  insertImageFile: string;
  insertTable: string;
  insertPageBreak: string;
  horizontalLine: string;
  undo: string;
  redo: string;
  clearFormatting: string;
  fileNamePlaceholder: string;
  fileNameLabel: string;
  headerFooterToggle: string;
  headerFooterToggleTitle: string;
  exportPdf: string;
  exporting: string;
  editorLabel: string;
  headerLabel: string;
  footerLabel: string;
  headerPlaceholder: string;
  footerPlaceholder: string;
  pageOf: string;
  words: string;
  characters: string;
  linkPrompt: string;
  imagePrompt: string;
  pageBreakLabel: string;
  pageBreakBetween: string;
}

export const MESSAGES_EN: EditorMessages = {
  toolbarLabel: 'Editor formatting tools',
  blockFormat: 'Block format',
  fontFamily: 'Font family',
  fontSize: 'Font size',
  bold: 'Bold (Ctrl+B)',
  italic: 'Italic (Ctrl+I)',
  underline: 'Underline (Ctrl+U)',
  strikethrough: 'Strikethrough',
  textColor: 'Text color',
  highlightColor: 'Highlight color',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  justify: 'Justify',
  bulletList: 'Bullet list',
  numberedList: 'Numbered list',
  decreaseIndent: 'Decrease indent',
  increaseIndent: 'Increase indent',
  insertLink: 'Insert link',
  insertImage: 'Insert image from URL',
  insertImageFile: 'Insert image from file',
  insertTable: 'Insert table',
  insertPageBreak: 'Insert page break',
  horizontalLine: 'Horizontal line',
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
  clearFormatting: 'Clear formatting',
  fileNamePlaceholder: 'Document name',
  fileNameLabel: 'PDF file name',
  headerFooterToggle: 'Header/Footer',
  headerFooterToggleTitle: 'Show header/footer settings',
  exportPdf: 'Export to PDF (Ctrl+S)',
  exporting: 'Exporting PDF...',
  editorLabel: 'Document editor',
  headerLabel: 'Header',
  footerLabel: 'Footer',
  headerPlaceholder: 'Header text',
  footerPlaceholder: 'Footer text (use {pageNumber} and {totalPages})',
  pageOf: 'Page {current} of {total}',
  words: 'words',
  characters: 'characters',
  linkPrompt: 'Enter URL:',
  imagePrompt: 'Enter image URL:',
  pageBreakLabel: 'Page break',
  pageBreakBetween: 'Page {current} | {next}',
};

export const MESSAGES_ES: EditorMessages = {
  toolbarLabel: 'Herramientas de formato',
  blockFormat: 'Formato de bloque',
  fontFamily: 'Fuente',
  fontSize: 'Tamaño de fuente',
  bold: 'Negrita (Ctrl+B)',
  italic: 'Cursiva (Ctrl+I)',
  underline: 'Subrayado (Ctrl+U)',
  strikethrough: 'Tachado',
  textColor: 'Color de texto',
  highlightColor: 'Color de resaltado',
  alignLeft: 'Alinear a la izquierda',
  alignCenter: 'Centrar',
  alignRight: 'Alinear a la derecha',
  justify: 'Justificar',
  bulletList: 'Lista con viñetas',
  numberedList: 'Lista numerada',
  decreaseIndent: 'Reducir sangría',
  increaseIndent: 'Aumentar sangría',
  insertLink: 'Insertar enlace',
  insertImage: 'Insertar imagen desde URL',
  insertImageFile: 'Insertar imagen desde archivo',
  insertTable: 'Insertar tabla',
  insertPageBreak: 'Insertar salto de página',
  horizontalLine: 'Línea horizontal',
  undo: 'Deshacer (Ctrl+Z)',
  redo: 'Rehacer (Ctrl+Y)',
  clearFormatting: 'Borrar formato',
  fileNamePlaceholder: 'Nombre del documento',
  fileNameLabel: 'Nombre del archivo PDF',
  headerFooterToggle: 'Cabecera/Pie',
  headerFooterToggleTitle: 'Mostrar ajustes de cabecera y pie',
  exportPdf: 'Exportar a PDF (Ctrl+S)',
  exporting: 'Exportando PDF...',
  editorLabel: 'Editor de documento',
  headerLabel: 'Cabecera',
  footerLabel: 'Pie de página',
  headerPlaceholder: 'Texto de la cabecera',
  footerPlaceholder: 'Texto del pie (usa {pageNumber} y {totalPages})',
  pageOf: 'Página {current} de {total}',
  words: 'palabras',
  characters: 'caracteres',
  linkPrompt: 'Introduce la URL:',
  imagePrompt: 'Introduce la URL de la imagen:',
  pageBreakLabel: 'Salto de página',
  pageBreakBetween: 'Página {current} | {next}',
};

const BUILT_IN: Record<string, EditorMessages> = { en: MESSAGES_EN, es: MESSAGES_ES };

/** Resuelve los textos: idioma integrado (por prefijo, 'es-ES' → 'es') + sobrescrituras. */
export function resolveMessages(locale?: string, overrides?: Partial<EditorMessages>): EditorMessages {
  const key = (locale ?? 'en').toLowerCase().split('-')[0];
  // Solo claves propias: 'constructor', '__proto__'... no deben resolver a nada
  const base = Object.prototype.hasOwnProperty.call(BUILT_IN, key) ? BUILT_IN[key] : MESSAGES_EN;
  return { ...base, ...overrides };
}

/** Sustituye `{clave}` por valores. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : m));
}
