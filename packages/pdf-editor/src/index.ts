// Main component
export { PdfEditor } from './PdfEditor';
export type { PdfEditorRef } from './PdfEditor';

// Framework-agnostic SDK (also available as '@jmt-code/pdf-editor/sdk')
export { createEditor } from './sdk';
export type {
  EditorInstance,
  EditorOptions,
  EditorDocument,
  EditorEvents,
  EditorTheme,
  EditorToolbarItem,
} from './sdk';

// Types
export type {
  PdfEditorProps,
  PdfEditorConfig,
  EditorState,
  TextFormat,
  EditorCommand,
  ToolbarButton,
  ToolbarGroup,
  FormatOption,
  ToolId,
  CustomToolbarItem,
  SelectionInfo,
  DocumentStats,
} from './types';

export {
  PAGE_DIMENSIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  BLOCK_FORMAT_OPTIONS,
} from './types';

// i18n
export { MESSAGES_EN, MESSAGES_ES, resolveMessages, formatMessage } from './i18n';
export type { EditorMessages } from './i18n';

// Components (for advanced customization)
export {
  Toolbar,
  HeaderFooterPanel,
  PageBreaks,
  PageBreakIndicator,
  DragIndicator,
  PageIndicator,
} from './components';

// Hooks (for advanced customization)
export {
  useEditorCommands,
  useMarkdownShortcuts,
  useDragAndDrop,
  usePageCalculation,
  usePaste,
} from './hooks';

// Utils
export { generatePdfFromContent, downloadPdf, parseHtmlToPdf } from './utils';
export { sanitizeHtml, isSafeUrl, sanitizePastedHtml } from './utils/sanitize';
export { buildHtmlDocument, printHtmlDocument } from './utils/exportHtml';
export type { HtmlExportOptions } from './utils/exportHtml';
