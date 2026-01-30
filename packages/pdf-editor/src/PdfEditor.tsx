import {
  useState,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import {
  Toolbar,
  HeaderFooterPanel,
  DragIndicator,
} from './components';
import {
  useEditorCommands,
  useMarkdownShortcuts,
  useDragAndDrop,
} from './hooks';
import { generatePdfFromContent, downloadPdf } from './utils';
import type {
  PdfEditorProps,
  PdfEditorConfig,
  EditorState,
  TextFormat,
} from './types';
import './PdfEditor.css';

/** Contenido inicial por defecto */
const DEFAULT_CONTENT = `<h1>Welcome to PDF Editor</h1>
<p>Start typing here... Use the toolbar above to format your text like in Word.</p>
<p>You can use <strong>Markdown shortcuts</strong>:</p>
<ul>
  <li># for headings</li>
  <li>**text** for bold</li>
  <li>*text* for italic</li>
  <li>- or * for lists</li>
  <li>&gt; for quotes</li>
  <li>\`\`\` for code blocks</li>
</ul>`;

/** Configuración por defecto */
const DEFAULT_CONFIG: Required<PdfEditorConfig> = {
  initialContent: DEFAULT_CONTENT,
  defaultHeaderText: 'HEADER',
  defaultFooterText: 'Page {pageNumber}',
  exportFileName: 'document',
  placeholder: 'Start typing...',
  readOnly: false,
  showHeaderFooterPanel: false,
  documentWidth: 210,
  documentMinHeight: 297,
};

/** Métodos expuestos del editor */
export interface PdfEditorRef {
  /** Obtiene el contenido HTML actual */
  getContent: () => string;
  /** Establece el contenido HTML */
  setContent: (html: string) => void;
  /** Exporta a PDF y devuelve el Blob */
  exportPdf: () => Promise<Blob>;
  /** Descarga el PDF */
  downloadPdf: (fileName?: string) => Promise<void>;
  /** Enfoca el editor */
  focus: () => void;
  /** Ejecuta un comando del editor */
  execCommand: (command: string, value?: string) => void;
}

/**
 * Editor de PDF tipo Word con soporte para markdown, 
 * formateo de texto y exportación a PDF
 */
export const PdfEditor = forwardRef<PdfEditorRef, PdfEditorProps>(
  ({ config = {}, onChange, onExport, onError, className = '', style }, ref) => {
    // Merge config with defaults
    const mergedConfig = useMemo(
      () => ({ ...DEFAULT_CONFIG, ...config }),
      [config]
    );

    // Refs
    const editorRef = useRef<HTMLDivElement>(null);

    // State
    const [state, setState] = useState<EditorState>({
      content: mergedConfig.initialContent,
      headerText: mergedConfig.defaultHeaderText,
      footerText: mergedConfig.defaultFooterText,
    });
    const [fileName, setFileName] = useState(mergedConfig.exportFileName);
    const [activeFormats, setActiveFormats] = useState<Set<TextFormat>>(
      new Set()
    );
    const [showHeaderFooter, setShowHeaderFooter] = useState(
      mergedConfig.showHeaderFooterPanel
    );
    const [isExporting, setIsExporting] = useState(false);

    // Hooks personalizados
    const { execCommand, formatBlock, insertLink, insertImage, updateActiveFormats } =
      useEditorCommands(editorRef, setActiveFormats);

    const { handleMarkdownInput } = useMarkdownShortcuts(editorRef, execCommand);

    const { getDragState, handlePointerDown, handlePointerUp, handlePointerCancel } =
      useDragAndDrop(editorRef);

    // Generar PDF
    const handleExport = useCallback(async () => {
      if (!editorRef.current || isExporting) return;

      try {
        setIsExporting(true);
        const pdfFileName = fileName.trim() || 'document';
        const blob = await generatePdfFromContent(
          editorRef.current.innerHTML,
          state.headerText,
          state.footerText,
          pdfFileName
        );

        if (onExport) {
          onExport(blob, pdfFileName);
        } else {
          downloadPdf(blob, pdfFileName);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to export PDF');
        onError?.(err);
        console.error('PDF export error:', error);
      } finally {
        setIsExporting(false);
      }
    }, [
      state.headerText,
      state.footerText,
      fileName,
      onExport,
      onError,
      isExporting,
    ]);

    // Keyboard shortcuts
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          switch (e.key.toLowerCase()) {
            case 'b':
              e.preventDefault();
              execCommand('bold');
              break;
            case 'i':
              e.preventDefault();
              execCommand('italic');
              break;
            case 'u':
              e.preventDefault();
              execCommand('underline');
              break;
            case 's':
              e.preventDefault();
              handleExport();
              break;
          }
        }
      },
      [execCommand, handleExport]
    );

    // Handle input
    const handleInput = useCallback(() => {
      handleMarkdownInput();
      updateActiveFormats();

      // Notificar cambio de contenido
      if (onChange && editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, [handleMarkdownInput, updateActiveFormats, onChange]);

    // Save content on blur
    const handleBlur = useCallback(() => {
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setState((prev) => ({ ...prev, content: newContent }));
        onChange?.(newContent);
      }
    }, [onChange]);

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        getContent: () => editorRef.current?.innerHTML || '',
        setContent: (html: string) => {
          if (editorRef.current) {
            editorRef.current.innerHTML = html;
            setState((prev) => ({ ...prev, content: html }));
          }
        },
        exportPdf: async () => {
          if (!editorRef.current) {
            throw new Error('Editor not initialized');
          }
          return generatePdfFromContent(
            editorRef.current.innerHTML,
            state.headerText,
            state.footerText,
            mergedConfig.exportFileName
          );
        },
        downloadPdf: async (fileName?: string) => {
          const blob = await generatePdfFromContent(
            editorRef.current?.innerHTML || '',
            state.headerText,
            state.footerText,
            fileName || mergedConfig.exportFileName
          );
          downloadPdf(blob, fileName || mergedConfig.exportFileName);
        },
        focus: () => editorRef.current?.focus(),
        execCommand,
      }),
      [state.headerText, state.footerText, mergedConfig.exportFileName, execCommand]
    );

    // Get drag state
    const dragState = getDragState();

    return (
      <div className={`pdf-editor ${className}`} style={style}>
        {/* Main Toolbar */}
        <Toolbar
          activeFormats={activeFormats}
          showHeaderFooter={showHeaderFooter}
          fileName={fileName}
          onFileNameChange={setFileName}
          onToggleHeaderFooter={() => setShowHeaderFooter(!showHeaderFooter)}
          onExport={handleExport}
          onCommand={execCommand}
          onFormatBlock={formatBlock}
          onInsertLink={insertLink}
          onInsertImage={insertImage}
        />

        {/* Header/Footer Panel */}
        {showHeaderFooter && (
          <HeaderFooterPanel
            headerText={state.headerText}
            footerText={state.footerText}
            onHeaderChange={(value) =>
              setState((prev) => ({ ...prev, headerText: value }))
            }
            onFooterChange={(value) =>
              setState((prev) => ({ ...prev, footerText: value }))
            }
          />
        )}

        {/* Editor Workspace - Editor continuo */}
        <div className="editor-workspace">
          <div className="document-container">
            {/* Header visual (solo para referencia del usuario) */}
            {state.headerText && (
              <div className="document-header">
                <span className="header-text">{state.headerText}</span>
              </div>
            )}
            
            {/* Área de contenido editable - sin límites de página */}
            <div
              ref={editorRef}
              className="editor-content"
              contentEditable={!mergedConfig.readOnly}
              suppressContentEditableWarning
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              onBlur={handleBlur}
              onMouseUp={updateActiveFormats}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              dangerouslySetInnerHTML={{ __html: state.content }}
              role="textbox"
              aria-multiline="true"
              aria-label="Document editor"
              data-placeholder={mergedConfig.placeholder}
            />
            
            {/* Footer visual (solo para referencia del usuario) */}
            {state.footerText && (
              <div className="document-footer">
                <span className="footer-text">
                  {state.footerText.replace('{pageNumber}', '•')}
                </span>
                <span className="footer-hint">(Page numbers added on export)</span>
              </div>
            )}
          </div>
        </div>

        {/* Drag indicator */}
        <DragIndicator
          isDragging={dragState.isDragging}
          selection={dragState.selection}
        />

        {/* Export loading overlay */}
        {isExporting && (
          <div className="export-overlay" role="alert" aria-busy="true">
            <div className="export-spinner" />
            <span>Exporting PDF...</span>
          </div>
        )}
      </div>
    );
  }
);

PdfEditor.displayName = 'PdfEditor';
