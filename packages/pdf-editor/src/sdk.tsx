/**
 * SDK independiente del framework.
 *
 *   import { createEditor } from '@jmt-code/pdf-editor/sdk';
 *   const editor = createEditor(document.getElementById('editor')!, { locale: 'es' });
 *   editor.on('change', ({ html }) => save(html));
 *
 * También disponible como <script> (build IIFE): window.PdfEditorSDK.createEditor(...)
 */
import { createRef, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { PdfEditor } from './PdfEditor';
import type { PdfEditorRef } from './PdfEditor';
import type {
  CustomToolbarItem,
  DocumentStats,
  PdfEditorConfig,
  SelectionInfo,
  ToolId,
} from './types';
import type { EditorMessages } from './i18n';
import { sanitizeHtml, isSafeCssBackground } from './utils/sanitize';
import { downloadPdf } from './utils/pdfGenerator';

/**
 * Documento serializable (sobre versionado). `html` es el contenido del editor: todo lo que
 * entra (contenido inicial, setHTML/setDocument, pegar, arrastrar desde fuera) se sanea al
 * entrar. Si se va a mostrar fuera del editor en otro contexto, sanéalo con sanitizeHtml().
 */
export interface EditorDocument {
  version: 1;
  html: string;
  header: string;
  footer: string;
  fileName: string;
}

/** Variables de tema (se aplican como variables CSS sobre el contenedor) */
export interface EditorTheme {
  background?: string;
  text?: string;
  primary?: string;
  primaryHover?: string;
  border?: string;
  toolbarBackground?: string;
  workspaceBackground?: string;
  pageBackground?: string;
  activeBackground?: string;
  activeColor?: string;
}

export interface EditorToolbarItem {
  id: string;
  label: string;
  title?: string;
  /** Recibe la instancia del editor */
  run: (editor: EditorInstance) => void;
}

export interface EditorOptions {
  /** HTML inicial o documento completo */
  content?: string | EditorDocument;
  header?: string;
  footer?: string;
  fileName?: string;
  placeholder?: string;
  readOnly?: boolean;
  /** 'en' (por defecto) o 'es'; otros idiomas vía `messages` */
  locale?: string;
  messages?: Partial<EditorMessages>;
  theme?: EditorTheme;
  /** false = sin barra de herramientas */
  toolbar?: boolean;
  hiddenTools?: ToolId[];
  toolbarItems?: EditorToolbarItem[];
  showHeaderFooterPanel?: boolean;
  /** Si se indica, el botón de exportar llama a esto en lugar de descargar */
  onExportRequest?: (pdf: Blob, fileName: string) => void;
  className?: string;
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
}

export interface EditorEvents {
  ready: EditorInstance;
  change: { html: string; document: EditorDocument };
  selectionchange: SelectionInfo;
  stats: DocumentStats;
  export: { format: 'pdf' | 'html'; data: Blob | string; fileName: string };
  error: Error;
  destroy: undefined;
}

type Listener<K extends keyof EditorEvents> = (payload: EditorEvents[K]) => void;

export interface EditorInstance {
  /** Se resuelve cuando el editor está montado */
  readonly ready: Promise<EditorInstance>;
  readonly element: HTMLElement;
  destroy(): void;
  isDestroyed(): boolean;
  focus(): void;
  getHTML(): string;
  setHTML(html: string): void;
  getDocument(): EditorDocument;
  setDocument(doc: Partial<EditorDocument>): void;
  /** Ejecuta un comando: bold, italic, underline, strikeThrough, undo, redo, justifyCenter,
   *  insertUnorderedList, foreColor (#hex), fontSize ('1'..'7'), formatBlock ('h1'), ... */
  execute(command: string, value?: string): void;
  insertTable(rows?: number, cols?: number): void;
  insertPageBreak(): void;
  exportPdf(): Promise<Blob>;
  downloadPdf(fileName?: string): Promise<void>;
  exportHtml(): string;
  print(): Promise<void>;
  getStats(): DocumentStats;
  setReadOnly(readOnly: boolean): void;
  /** Cambia idioma, textos, tema o barra de herramientas sin perder el contenido */
  configure(options: Pick<EditorOptions, 'locale' | 'messages' | 'theme' | 'toolbar' | 'hiddenTools' | 'toolbarItems' | 'placeholder'>): void;
  on<K extends keyof EditorEvents>(event: K, listener: Listener<K>): () => void;
  off<K extends keyof EditorEvents>(event: K, listener: Listener<K>): void;
}

const THEME_VARS: Record<keyof EditorTheme, string> = {
  background: '--pdf-editor-bg',
  text: '--pdf-editor-text',
  primary: '--pdf-editor-primary',
  primaryHover: '--pdf-editor-primary-hover',
  border: '--pdf-editor-border',
  toolbarBackground: '--pdf-editor-toolbar-bg',
  workspaceBackground: '--pdf-editor-workspace-bg',
  pageBackground: '--pdf-editor-page-bg',
  activeBackground: '--pdf-editor-active-bg',
  activeColor: '--pdf-editor-active-color',
};

/** Solo colores y degradados lineales simples: nada que pueda cargar recursos (url, image-set...) */
export const isSafeThemeValue = isSafeCssBackground;

function normalizeDocument(content: string | EditorDocument | undefined, options: EditorOptions) {
  if (content && typeof content === 'object') {
    return {
      html: content.html ?? '',
      header: content.header ?? options.header,
      footer: content.footer ?? options.footer,
      fileName: content.fileName ?? options.fileName,
    };
  }
  return { html: content, header: options.header, footer: options.footer, fileName: options.fileName };
}

interface HostProps {
  editorRef: React.RefObject<PdfEditorRef>;
  initialConfig: PdfEditorConfig;
  bridge: Bridge;
}

interface Presentation {
  locale?: string;
  messages?: Partial<EditorMessages>;
  hideToolbar?: boolean;
  hiddenTools?: ToolId[];
  toolbarItems?: CustomToolbarItem[];
  placeholder?: string;
}

interface Bridge {
  setReadOnly?: (value: boolean) => void;
  setPresentation?: (value: Presentation) => void;
  /** Valores vigentes (incluidos los cambiados antes de que React monte el editor) */
  getReadOnly: () => boolean;
  getPresentation: () => Presentation;
  onMounted: () => void;
  onChange: (html: string) => void;
  onMeta: () => void;
  onSelection: (info: SelectionInfo) => void;
  onStats: (stats: DocumentStats) => void;
  onExport?: (blob: Blob, fileName: string) => void;
  onError: (error: Error) => void;
}

/** Copia sin las claves undefined (para no tapar los valores por defecto del editor) */
function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Componente interno: permite cambiar opciones sin remontar (y sin perder el contenido) */
function Host({ editorRef, initialConfig, bridge }: HostProps) {
  // render() de React es asíncrono: se leen los valores vigentes al montar, así no se pierde
  // un setReadOnly()/configure() llamado justo después de createEditor()
  const [readOnly, setReadOnly] = useState(bridge.getReadOnly);
  const [presentation, setPresentation] = useState(bridge.getPresentation);
  bridge.setReadOnly = setReadOnly;
  bridge.setPresentation = setPresentation;

  useEffect(() => {
    bridge.onMounted();
  }, [bridge]);

  // Objeto estable mientras no cambien las opciones (PdfEditor memoiza sobre él). Se rehace
  // desde la configuración inicial, así una opción vuelta a undefined recupera su valor por defecto.
  const config = useMemo<PdfEditorConfig>(
    () => ({ ...initialConfig, readOnly, ...defined(presentation) }),
    [initialConfig, readOnly, presentation]
  );

  return (
    <PdfEditor
      ref={editorRef}
      config={config}
      className="pdf-editor--fill"
      onChange={bridge.onChange}
      onDocumentMetaChange={bridge.onMeta}
      onSelectionChange={bridge.onSelection}
      onStatsChange={bridge.onStats}
      onExport={bridge.onExport}
      onError={bridge.onError}
    />
  );
}

/**
 * Monta un editor en `element` y devuelve su API. El elemento debe tener altura (el editor
 * ocupa el 100% de su contenedor).
 */
export function createEditor(element: HTMLElement, userOptions: EditorOptions = {}): EditorInstance {
  // Copia propia: configure() nunca modifica el objeto del llamante
  const options: EditorOptions = { ...userOptions };
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('createEditor: element must be an HTMLElement');
  }
  if ((element as HTMLElement & { __pdfEditor?: EditorInstance }).__pdfEditor) {
    throw new Error('createEditor: an editor is already mounted on this element (call destroy() first)');
  }

  const listeners = new Map<keyof EditorEvents, Set<Listener<keyof EditorEvents>>>();
  const emit = <K extends keyof EditorEvents>(event: K, payload: EditorEvents[K]) => {
    listeners.get(event)?.forEach((listener) => {
      try {
        (listener as Listener<K>)(payload);
      } catch (error) {
        // Un listener que falla no debe romper el editor ni a los demás listeners
        console.error(`[pdf-editor] "${String(event)}" listener failed:`, error);
      }
    });
  };

  const editorRef = createRef<PdfEditorRef>();
  const doc = normalizeDocument(options.content, options);
  let destroyed = false;
  let root: Root | null = null;
  let resolveReady!: (instance: EditorInstance) => void;
  let rejectReady!: (error: Error) => void;
  let readySettled = false;
  const ready = new Promise<EditorInstance>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Evita "unhandled rejection" si nadie espera a ready y se destruye antes de montar
  ready.catch(() => undefined);
  let currentReadOnly = Boolean(options.readOnly);


  // Estado original del contenedor, para dejarlo exactamente igual al destruir
  const originalStyle = element.getAttribute('style');
  const originalClasses = new Set(Array.from(element.classList));
  const applyTheme = (theme: EditorTheme | undefined) => {
    for (const [key, cssVar] of Object.entries(THEME_VARS) as [keyof EditorTheme, string][]) {
      const value = theme?.[key];
      if (value && isSafeThemeValue(value)) element.style.setProperty(cssVar, value);
      else element.style.removeProperty(cssVar);
    }
  };
  const restoreContainer = () => {
    if (originalStyle === null) element.removeAttribute('style');
    else element.setAttribute('style', originalStyle);
    Array.from(element.classList).forEach((c) => {
      if (!originalClasses.has(c)) element.classList.remove(c);
    });
  };

  /** Ejecuta una operación asíncrona emitiendo 'error' si falla (y conservando el rechazo) */
  const tracked = async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      emit('error', err);
      throw err;
    }
  };

  const ensureAlive = () => {
    if (destroyed) throw new Error('This editor has been destroyed');
    const api = editorRef.current;
    if (!api) throw new Error('Editor not ready yet: await editor.ready');
    return api;
  };

  const toPresentation = (o: EditorOptions, instance: EditorInstance): Presentation => ({
    locale: o.locale,
    messages: o.messages,
    hideToolbar: o.toolbar === false,
    hiddenTools: o.hiddenTools,
    placeholder: o.placeholder,
    toolbarItems: o.toolbarItems?.map((item) => ({
      id: item.id,
      label: item.label,
      title: item.title,
      onClick: () => item.run(instance),
    })),
  });

  const getDocument = (): EditorDocument => {
    const api = ensureAlive();
    const { header, footer } = api.getHeaderFooter();
    return { version: 1, html: api.getContent(), header, footer, fileName: api.getFileName() };
  };

  const bridge: Bridge = {
    getReadOnly: () => currentReadOnly,
    getPresentation: () => toPresentation(options, instance),
    onMounted: () => {
      if (destroyed || readySettled) return;
      readySettled = true;
      resolveReady(instance);
      emit('ready', instance);
    },
    onChange: (html) => {
      if (destroyed || !editorRef.current) return;
      emit('change', { html, document: getDocument() });
    },
    onMeta: () => {
      if (destroyed || !editorRef.current) return;
      const document = getDocument();
      emit('change', { html: document.html, document });
    },
    onSelection: (info) => emit('selectionchange', info),
    onStats: (stats) => emit('stats', stats),
    onError: (error) => emit('error', error),
    onExport: (blob, fileName) => {
      emit('export', { format: 'pdf', data: blob, fileName });
      if (options.onExportRequest) {
        options.onExportRequest(blob, fileName);
      } else {
        // Comportamiento por defecto: descargar
        downloadPdf(blob, fileName);
      }
    },
  };

  const instance: EditorInstance = {
    ready,
    element,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (!readySettled) {
        readySettled = true;
        rejectReady(new Error('Editor destroyed before it was ready'));
      }
      root?.unmount();
      root = null;
      restoreContainer();
      delete (element as HTMLElement & { __pdfEditor?: EditorInstance }).__pdfEditor;
      emit('destroy', undefined);
      listeners.clear();
    },
    isDestroyed: () => destroyed,
    focus: () => ensureAlive().focus(),
    getHTML: () => ensureAlive().getContent(),
    setHTML: (html) => ensureAlive().setContent(html),
    getDocument,
    setDocument(next) {
      // Atómico en el editor: un único 'change' con el documento ya actualizado
      ensureAlive().setDocument(next);
    },
    execute(command, value) {
      const api = ensureAlive();
      if (currentReadOnly) return;
      api.execCommand(command, value);
    },
    insertTable(rows, cols) {
      const api = ensureAlive();
      if (currentReadOnly) return;
      api.insertTable(rows, cols);
    },
    insertPageBreak() {
      const api = ensureAlive();
      if (currentReadOnly) return;
      api.insertPageBreak();
    },
    exportPdf: () => tracked(async () => {
      const api = ensureAlive();
      const blob = await api.exportPdf();
      emit('export', { format: 'pdf', data: blob, fileName: api.getFileName() });
      return blob;
    }),
    downloadPdf: (fileName) => tracked(async () => {
      const api = ensureAlive();
      const blob = await api.exportPdf();
      const name = (fileName || api.getFileName()).trim() || 'document';
      emit('export', { format: 'pdf', data: blob, fileName: name });
      if (options.onExportRequest) options.onExportRequest(blob, name);
      else downloadPdf(blob, name);
    }),
    exportHtml: () => {
      const api = ensureAlive();
      const html = api.exportHtml();
      emit('export', { format: 'html', data: html, fileName: api.getFileName() });
      return html;
    },
    print: () => tracked(async () => ensureAlive().print()),
    getStats: () => ensureAlive().getStats(),
    setReadOnly(value) {
      if (destroyed) throw new Error('This editor has been destroyed');
      currentReadOnly = value;
      bridge.setReadOnly?.(value);
    },
    configure(next) {
      if (destroyed) throw new Error('This editor has been destroyed');
      Object.assign(options, next);
      if ('theme' in next) applyTheme(next.theme);
      bridge.setPresentation?.(toPresentation(options, instance));
    },
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener as Listener<keyof EditorEvents>);
      return () => instance.off(event, listener);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener as Listener<keyof EditorEvents>);
    },
  };

  (element as HTMLElement & { __pdfEditor?: EditorInstance }).__pdfEditor = instance;
  if (options.className) element.classList.add(...options.className.split(/\s+/).filter(Boolean));
  if (options.style) Object.assign(element.style, options.style);
  applyTheme(options.theme);

  const initialConfig: PdfEditorConfig = {
    initialContent: doc.html !== undefined ? sanitizeHtml(doc.html) : undefined,
    defaultHeaderText: doc.header,
    defaultFooterText: doc.footer,
    exportFileName: doc.fileName,
    showHeaderFooterPanel: options.showHeaderFooterPanel,
  };
  root = createRoot(element);
  root.render(
    <Host
      editorRef={editorRef as React.RefObject<PdfEditorRef>}
      initialConfig={defined(initialConfig)}
      bridge={bridge}
    />
  );
  return instance;
}
