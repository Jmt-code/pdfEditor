// Main component
export { PdfEditor } from './PdfEditor';
export type { PdfEditorRef } from './PdfEditor';

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
} from './types';

export {
  PAGE_DIMENSIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  BLOCK_FORMAT_OPTIONS,
} from './types';

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
} from './hooks';

// Utils
export { generatePdfFromContent, downloadPdf, parseHtmlToPdf } from './utils';
