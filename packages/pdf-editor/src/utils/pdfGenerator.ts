import { PdfCreator } from '@jmt-code/pdf-creator';
import { PAGE_DIMENSIONS, getContentHeightPerPage } from '../types';
import { collectLayout, paginate, pageIndexFor } from './htmlLayout';
import type { HtmlLayout, TextRun } from './htmlLayout';
import { sanitizeHtml, isSafeUrl } from './sanitize';

/** 1 px CSS (96 DPI) = 0,75 pt PDF (72 DPI) */
const PX_TO_PT = 0.75;

interface RenderTarget {
  /** Origen del área de contenido en la página PDF, en puntos */
  originX: number;
  originY: number;
  /** Página PDF (índice 0) en la que empieza el contenido */
  firstPage: number;
  /** Origen Y en las páginas siguientes a la primera, en puntos */
  nextPagesOriginY: number;
  /** Alto del área de contenido de una página, en px */
  pageHeightPx: number;
}

interface MountedLayout {
  layout: HtmlLayout;
}

/**
 * Monta el HTML (saneado) fuera de pantalla con los estilos del editor, espera a fuentes e
 * imágenes y mide la maquetación. El nodo temporal se elimina siempre.
 */
async function measureHtml(html: string, widthPx?: number): Promise<MountedLayout> {
  const host = document.createElement('div');
  host.className = 'pdf-editor pdf-editor--measure';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    // Sin visibility:hidden: se hereda y el recolector ignora el texto oculto
    'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;' +
    'height:auto;min-height:0;overflow:visible;display:block;';

  const content = document.createElement('div');
  content.className = 'editor-content';
  content.style.cssText = widthPx
    ? `width:${widthPx}px;padding:0;min-height:0;box-sizing:content-box;`
    : `width:${PAGE_DIMENSIONS.WIDTH_PX}px;min-height:0;box-sizing:border-box;`;
  content.innerHTML = sanitizeHtml(html);
  host.appendChild(content);
  document.body.appendChild(host);

  try {
    const images = Array.from(content.querySelectorAll('img'));
    await Promise.all(
      images.map(img => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined)))
    );
    if (document.fonts?.ready) await document.fonts.ready;

    return {
      layout: collectLayout(content, { decorations: true, isAllowedUrl: isSafeUrl }),
    };
  } finally {
    host.remove();
  }
}

/**
 * Dibuja una maquetación ya paginada sobre un PdfCreator.
 * Devuelve los avisos no fatales (p. ej. imágenes que no se pudieron cargar).
 */
async function renderLayout(
  pdf: PdfCreator,
  layout: HtmlLayout,
  breaks: number[],
  target: RenderTarget
): Promise<string[]> {
  const warnings: string[] = [];
  const pageNeeded = target.firstPage + breaks.length - 1;
  while (pdf.getPageCount() <= pageNeeded) pdf.addPage();

  /** Convierte una Y del contenido (px) a página + Y en puntos */
  const place = (yPx: number, pageIndex = pageIndexFor(breaks, yPx)) => {
    const origin = pageIndex === 0 ? target.originY : target.nextPagesOriginY;
    return {
      page: target.firstPage + pageIndex,
      y: origin + (yPx - breaks[pageIndex]) * PX_TO_PT,
    };
  };
  const toX = (xPx: number) => target.originX + xPx * PX_TO_PT;

  // 1. Fondos y bordes (se reparten entre páginas si cruzan un salto)
  for (const fill of layout.fills) {
    const top = fill.y;
    const bottom = fill.y + fill.height;
    for (let k = 0; k < breaks.length; k++) {
      const pageStart = breaks[k];
      const pageEnd = k + 1 < breaks.length ? breaks[k + 1] : Infinity;
      const segTop = Math.max(top, pageStart);
      const segBottom = Math.min(bottom, pageEnd);
      if (segBottom - segTop <= 0.01) continue;
      const { page, y } = place(segTop, k);
      pdf.setPage(page);
      pdf.addRect(toX(fill.x), y, fill.width * PX_TO_PT, (segBottom - segTop) * PX_TO_PT, { fill: fill.color });
    }
  }

  // 2. Imágenes
  for (const atom of layout.atoms) {
    if (atom.kind !== 'image') continue;
    const { page, y } = place(atom.y);
    pdf.setPage(page);
    try {
      // Una imagen más alta que la página se reduce proporcionalmente para que quepa
      const scale = Math.min(1, target.pageHeightPx / atom.height);
      await pdf.addImage(atom.src, toX(atom.x), y, {
        width: atom.width * scale * PX_TO_PT,
        height: atom.height * scale * PX_TO_PT,
        autoPageBreak: false,
      });
    } catch (error) {
      warnings.push(`Image skipped (${atom.src.slice(0, 80)}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 3. Texto: cada palabra en la posición medida por el navegador
  for (const atom of layout.atoms) {
    if (atom.kind !== 'text') continue;
    drawRun(pdf, atom, place, toX);
  }

  // 4. Subrayados / tachados
  for (const line of layout.lines) {
    const { page, y } = place(line.y);
    pdf.setPage(page);
    pdf.addLine(toX(line.x1), y, toX(line.x2), y, { color: line.color, width: line.thickness * PX_TO_PT });
  }

  // 5. Enlaces
  for (const link of layout.links) {
    const { page, y } = place(link.y);
    pdf.setPage(page);
    pdf.addLink(toX(link.x), y, link.width * PX_TO_PT, link.height * PX_TO_PT, link.url);
  }

  return warnings;
}

function drawRun(
  pdf: PdfCreator,
  run: TextRun,
  place: (yPx: number, pageIndex?: number) => { page: number; y: number },
  toX: (xPx: number) => number
): void {
  // La página se decide por la parte superior de la caja (igual que en paginate)
  const pageIndexPlace = place(run.y);
  const baselineY = pageIndexPlace.y + (run.baseline - run.y) * PX_TO_PT;
  pdf.setPage(pageIndexPlace.page);

  const size = run.sizePx * PX_TO_PT;
  // La paginación ya está decidida: el creador no debe saltar de página por su cuenta
  const options = { size, font: run.font, style: run.style, color: run.color, autoPageBreak: false };
  const naturalWidth = pdf.getTextWidth(run.text, options);
  const targetWidth = run.width * PX_TO_PT;

  if (run.fit === false) {
    pdf.addText(run.text, toX(run.x) + targetWidth - naturalWidth, baselineY, options);
    return;
  }

  // Ajusta el ancho de la fuente PDF al que ocupa la palabra en pantalla
  const scale = naturalWidth > 0 ? (targetWidth / naturalWidth) * 100 : 100;
  pdf.addText(run.text, toX(run.x), baselineY, {
    ...options,
    horizontalScale: Math.min(200, Math.max(50, scale)),
  });
}

/**
 * Pinta HTML en un PdfCreator existente a partir de (startX, startY) con un ancho dado (en
 * puntos). Las páginas siguientes empiezan en la parte superior del área de contenido.
 * Devuelve la Y (en puntos) bajo el último contenido de la última página usada.
 */
export async function parseHtmlToPdf(
  pdf: PdfCreator,
  html: string,
  startX: number,
  startY: number,
  width: number
): Promise<number> {
  const { layout } = await measureHtml(html, width / PX_TO_PT);
  const area = pdf.getContentArea();
  const firstPageHeightPx = (area.bottom - startY) / PX_TO_PT;
  const pageHeightPx = (area.bottom - area.top) / PX_TO_PT;

  // La primera página puede tener menos espacio: se pagina con un desplazamiento virtual
  const offset = pageHeightPx - firstPageHeightPx;
  const shifted = {
    atoms: layout.atoms.map(a => ({ ...a, y: a.y + offset })),
    fills: layout.fills.map(f => ({ ...f, y: f.y + offset })),
    forcedBreaks: layout.forcedBreaks.map(y => y + offset),
  };
  const breaks = paginate(shifted, pageHeightPx).map((b, i) => (i === 0 ? 0 : b - offset));

  const firstPage = pdf.getCurrentPageIndex();
  await renderLayout(pdf, layout, breaks, {
    originX: startX,
    originY: startY,
    firstPage,
    nextPagesOriginY: area.top,
    pageHeightPx,
  });

  // Final del contenido en la última página: texto, imágenes (ya reducidas a una página como
  // máximo, igual que al dibujarlas) y fondos/bordes (padding de <pre>, citas...)
  const lastIndex = breaks.length - 1;
  const lastStart = breaks[lastIndex];
  const bottoms = [
    ...layout.atoms.map(a => ({ y: a.y, bottom: a.y + (a.kind === 'image' ? Math.min(a.height, pageHeightPx) : a.height) })),
    ...layout.fills.map(f => ({ y: f.y, bottom: f.y + f.height })),
  ];
  const lastBottom = bottoms
    .filter(b => b.bottom > lastStart && pageIndexFor(breaks, Math.max(b.y, lastStart)) === lastIndex)
    .reduce((max, b) => Math.max(max, b.bottom), lastStart);
  const origin = lastIndex === 0 ? startY : area.top;
  const endY = origin + (lastBottom - lastStart) * PX_TO_PT;

  // Cursores: las páginas intermedias quedan llenas; la última, bajo el HTML, para que
  // addParagraph y compañía continúen detrás del contenido
  for (let k = 0; k < lastIndex; k++) {
    pdf.setPage(firstPage + k);
    pdf.setCursor(area.bottom);
  }
  pdf.setPage(firstPage + lastIndex);
  pdf.setCursor(endY);
  return endY;
}

/**
 * Genera el PDF a partir del contenido del editor, con la misma maquetación A4 que la vista
 * del editor (márgenes, cabecera y pie incluidos).
 */
export async function generatePdfFromContent(
  content: string,
  headerText: string,
  footerText: string,
  _fileName?: string
): Promise<Blob> {
  const hasHeader = Boolean(headerText);
  const hasFooter = Boolean(footerText);

  const pdf = new PdfCreator({
    headerHeight: hasHeader ? PAGE_DIMENSIONS.HEADER_HEIGHT_PX * PX_TO_PT : 0,
    footerHeight: hasFooter ? PAGE_DIMENSIONS.FOOTER_HEIGHT_PX * PX_TO_PT : 0,
    autoPageBreak: false,
    defaultHeader: hasHeader ? { text: headerText, align: 'center', color: '#666666' } : undefined,
    defaultFooter: hasFooter
      ? { text: footerText, showPageNumbers: false, align: 'center', color: '#666666' }
      : undefined,
  });

  const { layout } = await measureHtml(content);
  const pageHeightPx = getContentHeightPerPage(hasHeader, hasFooter);
  const breaks = paginate(layout, pageHeightPx);

  const originY =
    ((hasHeader ? PAGE_DIMENSIONS.HEADER_HEIGHT_PX : 0) + PAGE_DIMENSIONS.CONTENT_PADDING_Y_PX) * PX_TO_PT;
  const warnings = await renderLayout(pdf, layout, breaks, {
    originX: PAGE_DIMENSIONS.CONTENT_PADDING_X_PX * PX_TO_PT,
    originY,
    firstPage: 0,
    nextPagesOriginY: originY,
    pageHeightPx,
  });
  warnings.forEach(w => console.warn(`[pdf-editor] ${w}`));

  return pdf.getOutput();
}

/**
 * Descarga el PDF
 */
export function downloadPdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revocar en el mismo tick puede cancelar la descarga en algunos navegadores
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
