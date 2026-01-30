/**
 * PDF Editor Types
 * Tipos centralizados para el editor de PDF
 */

/** Configuración del editor */
export interface PdfEditorConfig {
  /** Contenido HTML inicial del editor */
  initialContent?: string;
  /** Texto del header por defecto */
  defaultHeaderText?: string;
  /** Texto del footer por defecto (usa {pageNumber} para número de página) */
  defaultFooterText?: string;
  /** Nombre del archivo al exportar */
  exportFileName?: string;
  /** Placeholder cuando el editor está vacío */
  placeholder?: string;
  /** Si el editor es de solo lectura */
  readOnly?: boolean;
  /** Mostrar panel de header/footer por defecto */
  showHeaderFooterPanel?: boolean;
  /** Ancho del documento en mm (default: 210 para A4) */
  documentWidth?: number;
  /** Alto mínimo del documento en mm (default: 297 para A4) */
  documentMinHeight?: number;
}

/** Props del componente PdfEditor */
export interface PdfEditorProps {
  /** Configuración del editor */
  config?: PdfEditorConfig;
  /** Callback cuando el contenido cambia */
  onChange?: (content: string) => void;
  /** Callback cuando se exporta el PDF (recibe el blob y el nombre del archivo) */
  onExport?: (blob: Blob, fileName: string) => void;
  /** Callback cuando hay un error */
  onError?: (error: Error) => void;
  /** Clases CSS adicionales */
  className?: string;
  /** Estilos inline adicionales */
  style?: React.CSSProperties;
}

/** Estado interno del editor */
export interface EditorState {
  content: string;
  headerText: string;
  footerText: string;
}

/** Estado de arrastre */
export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  selection: string;
}

/** Formatos de texto activos */
export type TextFormat = 
  | 'bold' 
  | 'italic' 
  | 'underline' 
  | 'strikethrough'
  | 'ul' 
  | 'ol'
  | 'left' 
  | 'center' 
  | 'right' 
  | 'justify';

/** Comandos del editor */
export type EditorCommand = 
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull'
  | 'formatBlock'
  | 'fontName'
  | 'fontSize'
  | 'foreColor'
  | 'hiliteColor'
  | 'createLink'
  | 'insertImage'
  | 'insertHorizontalRule'
  | 'indent'
  | 'outdent'
  | 'undo'
  | 'redo'
  | 'removeFormat'
  | 'insertHTML';

/** Definición de un botón de la toolbar */
export interface ToolbarButton {
  id: string;
  icon: React.ReactNode;
  title: string;
  command?: EditorCommand;
  value?: string;
  onClick?: () => void;
  isActive?: (formats: Set<TextFormat>) => boolean;
}

/** Grupo de botones de la toolbar */
export interface ToolbarGroup {
  id: string;
  buttons: ToolbarButton[];
}

/** Opciones para el dropdown de formato */
export interface FormatOption {
  value: string;
  label: string;
}

/** Constantes de dimensiones de página */
export const PAGE_DIMENSIONS = {
  /** Alto de página A4 en pixels (297mm a 96 DPI) - Aproximadamente 1122.52px */
  HEIGHT_PX: 1122,
  /** Ancho de página A4 en pixels (210mm a 96 DPI) - Aproximadamente 793.7px */
  WIDTH_PX: 794,
  /** Alto del header en pixels (50px) */
  HEADER_HEIGHT_PX: 50,
  /** Alto del footer en pixels (50px) */
  FOOTER_HEIGHT_PX: 50,
  /** Padding vertical del contenido en pixels (15mm ≈ 57px) */
  CONTENT_PADDING_Y_PX: 57,
  /** Padding horizontal del contenido en pixels (20mm ≈ 76px) */
  CONTENT_PADDING_X_PX: 76,
  /** Espacio del separador de página en pixels */
  PAGE_GAP_PX: 40,
  /** Ancho de página A4 en puntos PDF */
  PDF_WIDTH: 595.28,
  /** Alto de página A4 en puntos PDF */
  PDF_HEIGHT: 841.89,
} as const;

/**
 * Calcula el alto disponible para contenido por página
 */
export function getContentHeightPerPage(hasHeader: boolean, hasFooter: boolean): number {
  const headerH = hasHeader ? PAGE_DIMENSIONS.HEADER_HEIGHT_PX : 0;
  const footerH = hasFooter ? PAGE_DIMENSIONS.FOOTER_HEIGHT_PX : 0;
  return PAGE_DIMENSIONS.HEIGHT_PX - headerH - footerH - (PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX * 2);
}

/** Opciones de fuentes disponibles */
export const FONT_OPTIONS: FormatOption[] = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Helvetica', label: 'Helvetica' },
];

/** Opciones de tamaño de fuente */
export const FONT_SIZE_OPTIONS: FormatOption[] = [
  { value: '1', label: '8pt' },
  { value: '2', label: '10pt' },
  { value: '3', label: '12pt' },
  { value: '4', label: '14pt' },
  { value: '5', label: '18pt' },
  { value: '6', label: '24pt' },
  { value: '7', label: '36pt' },
];

/** Opciones de formato de bloque */
export const BLOCK_FORMAT_OPTIONS: FormatOption[] = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'pre', label: 'Code Block' },
  { value: 'blockquote', label: 'Quote' },
];
