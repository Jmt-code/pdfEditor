import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import {
  Toolbar,
  HeaderFooterPanel,
  DragIndicator,
  PageBreaks,
  PageIndicator,
} from './components';
import {
  useEditorCommands,
  useMarkdownShortcuts,
  useDragAndDrop,
  usePageCalculation,
  usePaste,
} from './hooks';
import { generatePdfFromContent, downloadPdf, sanitizeHtml } from './utils';
import { readActiveFormats } from './hooks/useEditorCommands';
import { buildHtmlDocument, printHtmlDocument } from './utils/exportHtml';
import { resolveMessages } from './i18n';
import type {
  PdfEditorProps,
  PdfEditorConfig,
  EditorState,
  TextFormat,
  DocumentStats,
  SelectionInfo,
} from './types';
import { PAGE_DIMENSIONS } from './types';
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

/** Configuración por defecto (las opciones sin valor por defecto quedan opcionales) */
const DEFAULT_CONFIG = {
  initialContent: DEFAULT_CONTENT,
  defaultHeaderText: 'HEADER',
  defaultFooterText: 'Page {pageNumber}',
  exportFileName: 'document',
  placeholder: 'Start typing...',
  readOnly: false,
  showHeaderFooterPanel: false,
  hideToolbar: false,
} satisfies PdfEditorConfig;

/** Métodos expuestos del editor */
export interface PdfEditorRef {
  /** Obtiene el contenido HTML actual */
  getContent: () => string;
  /** Establece el contenido HTML (se sanea) */
  setContent: (html: string) => void;
  /** Cabecera y pie actuales */
  getHeaderFooter: () => { header: string; footer: string };
  /** Cambia cabecera y/o pie */
  setHeaderFooter: (value: { header?: string; footer?: string }) => void;
  /**
   * Cambia contenido y metadatos a la vez, con una única notificación: onChange si cambia el
   * HTML (los metadatos ya son visibles para entonces) u onDocumentMetaChange si solo cambian
   * cabecera, pie o nombre.
   */
  setDocument: (doc: { html?: string; header?: string; footer?: string; fileName?: string }) => void;
  /** Nombre de archivo actual (sin .pdf) */
  getFileName: () => string;
  setFileName: (name: string) => void;
  /** Exporta a PDF y devuelve el Blob */
  exportPdf: () => Promise<Blob>;
  /** Descarga el PDF */
  downloadPdf: (fileName?: string) => Promise<void>;
  /** Documento HTML autónomo y saneado */
  exportHtml: () => string;
  /** Abre el diálogo de impresión del navegador */
  print: () => Promise<void>;
  /** Palabras, caracteres y páginas */
  getStats: () => DocumentStats;
  /** Enfoca el editor */
  focus: () => void;
  /** Ejecuta un comando del editor (document.execCommand) */
  execCommand: (command: string, value?: string) => void;
  /** Inserta una tabla de filas × columnas */
  insertTable: (rows?: number, cols?: number) => void;
  /** Inserta un salto de página manual */
  insertPageBreak: () => void;
}

/** Palabras y caracteres del texto visible */
function countText(el: HTMLElement | null): { words: number; characters: number } {
  const text = (el?.innerText ?? el?.textContent ?? '').replace(/ /g, ' ');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, characters: text.replace(/\s/g, '').length };
}


/**
 * Editor de PDF tipo Word con soporte para markdown,
 * formateo de texto y exportación a PDF
 */
export const PdfEditor = forwardRef<PdfEditorRef, PdfEditorProps>(
  ({ config = {}, onChange, onExport, onError, onSelectionChange, onStatsChange, onDocumentMetaChange, className = '', style }, ref) => {
    // Merge config with defaults
    const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
    const t = useMemo(
      () => resolveMessages(mergedConfig.locale, mergedConfig.messages),
      [mergedConfig.locale, mergedConfig.messages]
    );
    const readOnly = mergedConfig.readOnly;

    // Refs
    const editorRef = useRef<HTMLDivElement>(null);

    // State
    const [state, setState] = useState<EditorState>({
      content: sanitizeHtml(mergedConfig.initialContent),
      headerText: mergedConfig.defaultHeaderText,
      footerText: mergedConfig.defaultFooterText,
    });
    const [fileName, setFileName] = useState(mergedConfig.exportFileName);
    const [activeFormats, setActiveFormats] = useState<Set<TextFormat>>(new Set());
    const [showHeaderFooter, setShowHeaderFooter] = useState(mergedConfig.showHeaderFooterPanel);
    const [isExporting, setIsExporting] = useState(false);
    const [textStats, setTextStats] = useState(() => ({ words: 0, characters: 0 }));

    const [currentPage, setCurrentPage] = useState(1);
    const lastNotifiedContent = useRef(state.content);
    const notifyContentChange = useCallback(() => {
      const content = editorRef.current?.innerHTML;
      if (content !== undefined && content !== lastNotifiedContent.current) {
        lastNotifiedContent.current = content;
        onChange?.(content);
      }
    }, [onChange]);

    // Hooks personalizados
    const {
      execCommand, formatBlock, insertLink, insertImage, insertImageFromFile,
      insertTable, insertPageBreak, updateActiveFormats,
    } = useEditorCommands(editorRef, setActiveFormats, notifyContentChange, readOnly, {
      link: t.linkPrompt,
      image: t.imagePrompt,
    });

    const { handleMarkdownInput } = useMarkdownShortcuts(editorRef, execCommand, readOnly);

    const { getDragState, handlePointerDown, handlePointerUp, handlePointerCancel } =
      useDragAndDrop(editorRef, readOnly);

    // Page calculation
    const hasHeader = Boolean(state.headerText);
    const hasFooter = Boolean(state.footerText);
    const { pageCount, pageBreaks, recalculate } = usePageCalculation(editorRef, hasHeader, hasFooter);

    // innerText fuerza un layout y recorre todo el documento: se calcula con debounce
    const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const computeStats = useCallback(() => {
      setTextStats((prev) => {
        const next = countText(editorRef.current);
        return prev.words === next.words && prev.characters === next.characters ? prev : next;
      });
    }, []);
    const refreshStats = useCallback(() => {
      if (statsTimer.current) clearTimeout(statsTimer.current);
      statsTimer.current = setTimeout(() => {
        statsTimer.current = null;
        setTextStats((prev) => {
          const next = countText(editorRef.current);
          return prev.words === next.words && prev.characters === next.characters ? prev : next;
        });
      }, 150);
    }, []);
    useEffect(() => () => {
      if (statsTimer.current) clearTimeout(statsTimer.current);
    }, []);

    const afterContentChange = useCallback(() => {
      recalculate();
      refreshStats();
      notifyContentChange();
    }, [recalculate, refreshStats, notifyContentChange]);

    const { handlePaste, handleDrop, handleDragStart, handleDragEnd, pastingRef } = usePaste(editorRef, { disabled: readOnly, onPasted: afterContentChange });

    // Cabecera, pie y nombre de archivo también forman parte del documento
    const lastMeta = useRef({ header: state.headerText, footer: state.footerText, fileName });
    // Valores más recientes, también los fijados por la API imperativa antes del siguiente render
    const metaRef = useRef({ header: state.headerText, footer: state.footerText, fileName });
    metaRef.current = { header: state.headerText, footer: state.footerText, fileName };
    useEffect(() => {
      const meta = { header: state.headerText, footer: state.footerText, fileName };
      const prev = lastMeta.current;
      if (prev.header === meta.header && prev.footer === meta.footer && prev.fileName === meta.fileName) return;
      lastMeta.current = meta;
      onDocumentMetaChange?.(meta);
    }, [state.headerText, state.footerText, fileName, onDocumentMetaChange]);

    // Recuento inicial inmediato; las estadísticas no se emiten hasta tenerlo
    const statsReady = useRef(false);
    useEffect(() => {
      computeStats();
      statsReady.current = true;
    }, [computeStats]);

    // Callbacks en refs: un callback en línea (nueva función en cada render) no debe volver a
    // disparar efectos ni re-suscribir listeners
    const onStatsChangeRef = useRef(onStatsChange);
    onStatsChangeRef.current = onStatsChange;
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;

    // Solo cuando los números cambian de verdad (evita bucles si el padre hace setState)
    const lastStats = useRef<DocumentStats | null>(null);
    useEffect(() => {
      if (!statsReady.current) return;
      const prev = lastStats.current;
      if (prev && prev.words === textStats.words && prev.characters === textStats.characters && prev.pages === pageCount) return;
      const stats = { ...textStats, pages: pageCount };
      lastStats.current = stats;
      onStatsChangeRef.current?.(stats);
    }, [textStats, pageCount]);

    // Cambios de selección dentro del editor (agrupados por fotograma: selectionchange se
    // dispara continuamente mientras se escribe o se arrastra)
    const wantsSelection = Boolean(onSelectionChange);
    useEffect(() => {
      if (!wantsSelection) return;
      let frame = 0;
      const emit = () => {
        frame = 0;
        const selection = window.getSelection();
        const editor = editorRef.current;
        if (!selection || !editor || !selection.anchorNode || !editor.contains(selection.anchorNode)) return;
        const info: SelectionInfo = {
          text: selection.isCollapsed ? '' : selection.toString(),
          collapsed: selection.isCollapsed,
          formats: readActiveFormats(),
        };
        onSelectionChangeRef.current?.(info);
      };
      const handler = () => {
        if (!frame) frame = requestAnimationFrame(emit);
      };
      document.addEventListener('selectionchange', handler);
      return () => {
        document.removeEventListener('selectionchange', handler);
        if (frame) cancelAnimationFrame(frame);
      };
    }, [wantsSelection]);

    // Exportaciones con los metadatos vigentes (también los recién fijados por la API
    // imperativa, aunque React aún no haya vuelto a renderizar)
    const createPdf = useCallback(
      (name: string) =>
        generatePdfFromContent(editorRef.current?.innerHTML ?? '', metaRef.current.header, metaRef.current.footer, name),
      []
    );

    // Generar PDF
    const handleExport = useCallback(async () => {
      if (!editorRef.current || isExporting) return;

      try {
        setIsExporting(true);
        const pdfFileName = fileName.trim() || 'document';
        const blob = await createPdf(pdfFileName);

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
    }, [createPdf, fileName, onExport, onError, isExporting]);

    // Keyboard shortcuts
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (readOnly) return;
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
            case 'enter':
              // Ctrl+Enter: salto de página, como en Word
              e.preventDefault();
              insertPageBreak();
              break;
          }
        }
      },
      [execCommand, handleExport, insertPageBreak, readOnly]
    );

    // Handle input
    const handleInput = useCallback(() => {
      // El contenido pegado se notifica desde usePaste y nunca se interpreta como Markdown
      if (readOnly || pastingRef.current) return;
      handleMarkdownInput();
      updateActiveFormats();
      afterContentChange();
    }, [handleMarkdownInput, updateActiveFormats, afterContentChange, readOnly, pastingRef]);

    // Save content on blur
    const handleBlur = useCallback(() => {
      if (editorRef.current) {
        const newContent = editorRef.current.innerHTML;
        setState((prev) => ({ ...prev, content: newContent }));
        notifyContentChange();
      }
    }, [notifyContentChange]);

    const exportHtml = useCallback(
      () =>
        buildHtmlDocument(editorRef.current?.innerHTML ?? '', {
          title: metaRef.current.fileName.trim() || 'document',
          headerText: metaRef.current.header,
          footerText: metaRef.current.footer,
          lang: mergedConfig.locale ?? 'en',
        }),
      [mergedConfig.locale]
    );

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        getContent: () => editorRef.current?.innerHTML || '',
        setContent: (html: string) => {
          if (editorRef.current) {
            const content = sanitizeHtml(html);
            editorRef.current.innerHTML = content;
            setState((prev) => ({ ...prev, content }));
            afterContentChange();
          }
        },
        getHeaderFooter: () => ({ header: metaRef.current.header, footer: metaRef.current.footer }),
        setHeaderFooter: ({ header, footer }) => {
          // Visible de inmediato para getHeaderFooter/getDocument (el render llega después)
          metaRef.current = {
            ...metaRef.current,
            header: header ?? metaRef.current.header,
            footer: footer ?? metaRef.current.footer,
          };
          setState((prev) => ({
            ...prev,
            headerText: header ?? prev.headerText,
            footerText: footer ?? prev.footerText,
          }));
        },
        setDocument: (doc) => {
          const prevMeta = metaRef.current;
          const nextMeta = {
            header: doc.header ?? prevMeta.header,
            footer: doc.footer ?? prevMeta.footer,
            fileName: doc.fileName ?? prevMeta.fileName,
          };
          const metaChanged = nextMeta.header !== prevMeta.header
            || nextMeta.footer !== prevMeta.footer
            || nextMeta.fileName !== prevMeta.fileName;
          metaRef.current = nextMeta;
          // El efecto de metadatos no debe volver a notificar este cambio
          lastMeta.current = nextMeta;
          setState((prev) => ({ ...prev, headerText: nextMeta.header, footerText: nextMeta.footer }));
          setFileName(nextMeta.fileName);

          let contentNotified = false;
          if (doc.html !== undefined && editorRef.current) {
            const content = sanitizeHtml(doc.html);
            editorRef.current.innerHTML = content;
            setState((prev) => ({ ...prev, content }));
            recalculate();
            refreshStats();
            const before = lastNotifiedContent.current;
            notifyContentChange();
            contentNotified = lastNotifiedContent.current !== before;
          }
          if (metaChanged && !contentNotified) onDocumentMetaChange?.(nextMeta);
        },
        getFileName: () => metaRef.current.fileName,
        setFileName: (name: string) => {
          metaRef.current = { ...metaRef.current, fileName: name };
          setFileName(name);
        },
        exportPdf: async () => {
          if (!editorRef.current) {
            throw new Error('Editor not initialized');
          }
          return createPdf(metaRef.current.fileName.trim() || 'document');
        },
        downloadPdf: async (name?: string) => {
          const pdfFileName = (name || metaRef.current.fileName).trim() || 'document';
          downloadPdf(await createPdf(pdfFileName), pdfFileName);
        },
        exportHtml,
        print: () => printHtmlDocument(exportHtml()),
        getStats: () => ({ ...countText(editorRef.current), pages: pageCount }),
        focus: () => editorRef.current?.focus(),
        execCommand,
        insertTable,
        insertPageBreak,
      }),
      [createPdf, exportHtml, pageCount, execCommand, insertTable, insertPageBreak, afterContentChange, recalculate, refreshStats, notifyContentChange, onDocumentMetaChange]
    );

    // Get drag state
    const dragState = getDragState();
    const footerPreview = state.footerText
      .replace(/\{pageNumber\}/g, String(pageCount))
      .replace(/\{totalPages\}/g, String(pageCount));

    return (
      <div className={`pdf-editor ${className}`} style={style}>
        {/* Main Toolbar */}
        {!mergedConfig.hideToolbar && (
          <Toolbar
            disabled={readOnly}
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
            onInsertImageFile={insertImageFromFile}
            onInsertTable={() => insertTable()}
            onInsertPageBreak={insertPageBreak}
            messages={t}
            hiddenTools={mergedConfig.hiddenTools}
            customItems={mergedConfig.toolbarItems}
          />
        )}

        {/* Header/Footer Panel */}
        {showHeaderFooter && (
          <HeaderFooterPanel
            headerText={state.headerText}
            footerText={state.footerText}
            onHeaderChange={(value) => setState((prev) => ({ ...prev, headerText: value }))}
            onFooterChange={(value) => setState((prev) => ({ ...prev, footerText: value }))}
            messages={t}
            disabled={readOnly}
          />
        )}

        {/* Editor Workspace - Word-like pages */}
        <div className="editor-workspace" onScroll={(event) => {
          const workspace = event.currentTarget;
          const documentTop = workspace.querySelector('.content-wrapper')?.getBoundingClientRect().top ?? workspace.getBoundingClientRect().top;
          const offset = Math.max(0, workspace.getBoundingClientRect().top - documentTop);
          // Página actual según los inicios reales de página (saltos manuales incluidos)
          const contentOffset = offset - PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX;
          const page = pageBreaks.filter((start) => start <= contentOffset + 1).length;
          setCurrentPage(Math.min(pageCount, Math.max(1, page)));
        }}>
          <div className="document-container">
            {/* First page header */}
            {state.headerText && (
              <div className="page-header-visual">
                <span className="page-header-text">{state.headerText}</span>
              </div>
            )}

            {/* Content wrapper with page break overlays */}
            <div className="content-wrapper">
              <div
                ref={editorRef}
                className="editor-content"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onBlur={handleBlur}
                onMouseUp={updateActiveFormats}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                dangerouslySetInnerHTML={{ __html: state.content }}
                role="textbox"
                aria-multiline="true"
                aria-readonly={readOnly}
                aria-label={t.editorLabel}
                data-placeholder={mergedConfig.placeholder}
                style={{
                  minHeight: `${PAGE_DIMENSIONS.HEIGHT_PX - (hasHeader ? PAGE_DIMENSIONS.HEADER_HEIGHT_PX : 0) - (hasFooter ? PAGE_DIMENSIONS.FOOTER_HEIGHT_PX : 0)}px`,
                  ['--pdf-page-break-label' as string]: JSON.stringify(t.pageBreakLabel),
                }}
              />

              {/* Page break overlays */}
              <PageBreaks
                pageCount={pageCount}
                headerText={state.headerText}
                footerText={state.footerText}
                breaks={pageBreaks}
                label={t.pageBreakBetween}
              />
            </div>

            {/* Last page footer */}
            {state.footerText && (
              <div className="page-footer-visual">
                <span className="page-footer-text">{footerPreview}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="editor-status-bar">
          <PageIndicator currentPage={Math.min(currentPage, pageCount)} totalPages={pageCount} template={t.pageOf} />
          <span className="status-stats">
            {textStats.words} {t.words} · {textStats.characters} {t.characters}
          </span>
          <span className="status-info">
            {isExporting ? t.exporting : `${fileName || 'document'}.pdf`}
          </span>
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
            <span>{t.exporting}</span>
          </div>
        )}
      </div>
    );
  }
);

PdfEditor.displayName = 'PdfEditor';
