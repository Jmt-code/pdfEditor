import { sanitizeHtml, escapeHtml as escapeText } from './sanitize';

/** Estilos mínimos del documento (los mismos criterios visuales que el editor) */
const DOCUMENT_CSS = `
  @page { size: A4; margin: 15mm 20mm; }
  body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
         font-size: 12pt; line-height: 1.6; color: #333; max-width: 170mm; margin: 0 auto; padding: 15mm 0; }
  h1 { font-size: 24pt; font-weight: 600; margin: 0 0 16px; color: #1a1a1a; }
  h2 { font-size: 20pt; font-weight: 600; margin: 24px 0 12px; color: #1a1a1a; }
  h3 { font-size: 16pt; font-weight: 600; margin: 20px 0 10px; color: #1a1a1a; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 12px; padding-left: 24px; }
  blockquote { margin: 16px 0; padding: 12px 20px; border-left: 4px solid #0078d4; background: #f8f9fa; color: #555; font-style: italic; }
  pre { margin: 16px 0; padding: 16px; background: #2d2d2d; color: #f8f8f2; border-radius: 6px; white-space: pre-wrap;
        font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 11pt; }
  code { padding: 2px 6px; background: #f0f0f0; border-radius: 3px; font-family: Consolas, Monaco, 'Courier New', monospace; font-size: 11pt; color: #d63384; }
  pre code { padding: 0; background: transparent; color: inherit; }
  a { color: #0078d4; }
  img { max-width: 100%; height: auto; }
  hr { border: none; border-top: 1px solid #d4d4d4; margin: 24px 0; }
  table { border-collapse: collapse; width: 100%; margin: 0 0 12px; }
  th, td { border: 1px solid #c8c8c8; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f3f3; font-weight: 600; }
  [data-page-break] { break-after: page; page-break-after: always; height: 0; }
  .doc-header, .doc-footer { color: #666; font-size: 10pt; text-align: center; }
`;

export interface HtmlExportOptions {
  title?: string;
  headerText?: string;
  footerText?: string;
  lang?: string;
}

/**
 * Documento HTML autónomo (saneado) con el contenido del editor. Útil para guardar, enviar por
 * correo o imprimir. Los marcadores {pageNumber}/{totalPages} del pie se eliminan, porque en
 * HTML no hay páginas.
 */
export function buildHtmlDocument(contentHtml: string, options: HtmlExportOptions = {}): string {
  const { title = 'Document', headerText = '', footerText = '', lang = 'en' } = options;
  // En HTML no hay páginas: un pie que depende de los números de página no se incluye
  const footer = /\{(pageNumber|totalPages)\}/.test(footerText) ? '' : footerText.trim();
  return `<!doctype html>
<html lang="${escapeText(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
${headerText ? `<header class="doc-header">${escapeText(headerText)}</header>\n` : ''}<main>
${sanitizeHtml(contentHtml)}
</main>
${footer ? `<footer class="doc-footer">${escapeText(footer)}</footer>\n` : ''}</body>
</html>
`;
}

/**
 * Imprime el documento con el diálogo del navegador usando un iframe oculto (sin ventanas
 * emergentes). Se resuelve cuando se ha abierto el diálogo.
 */
export function printHtmlDocument(documentHtml: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    // Sin scripts: el contenido ya está saneado y el iframe no necesita ejecutar nada
    iframe.setAttribute('sandbox', 'allow-modals allow-same-origin');
    iframe.srcdoc = documentHtml;
    iframe.onload = () => {
      const win = iframe.contentWindow;
      // En algunos navegadores (Safari) print() vuelve antes de cerrar el diálogo: el iframe se
      // quita al terminar la impresión (afterprint) o, como red de seguridad, al cabo de 1 min
      const cleanup = () => iframe.remove();
      const fallback = setTimeout(cleanup, 60_000);
      win?.addEventListener('afterprint', () => {
        clearTimeout(fallback);
        setTimeout(cleanup, 0);
      }, { once: true });
      try {
        win?.focus();
        win?.print();
        resolve();
      } catch (error) {
        clearTimeout(fallback);
        cleanup();
        reject(error);
      }
    };
    document.body.appendChild(iframe);
  });
}
