import { PdfCreator, TextOptions } from '@jmt-code/pdf-creator';
import { PAGE_DIMENSIONS } from '../types';

interface ComputedStyles {
  fontWeight: string;
  fontStyle: string;
  textDecoration: string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  color: string;
  fontSize: string;
  fontFamily: string;
}

interface LineBufferItem {
  text: string;
  style: TextOptions;
}

/**
 * Convierte un color RGB a hexadecimal
 */
function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Obtiene los estilos computados de un elemento
 */
function getComputedStyles(el: HTMLElement): ComputedStyles {
  const computed = window.getComputedStyle(el);
  return {
    fontWeight: computed.fontWeight,
    fontStyle: computed.fontStyle,
    textDecoration: computed.textDecoration,
    textAlign: computed.textAlign as 'left' | 'center' | 'right' | 'justify',
    color: computed.color,
    fontSize: computed.fontSize,
    fontFamily: computed.fontFamily,
  };
}

/**
 * Parsea el contenido HTML y lo convierte a comandos PDF
 */
export async function parseHtmlToPdf(
  pdf: PdfCreator,
  html: string,
  startX: number,
  startY: number,
  width: number
): Promise<number> {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  tempDiv.style.cssText = `position:absolute;visibility:hidden;width:${width}px;`;
  document.body.appendChild(tempDiv);

  let currentX = startX;
  let currentY = startY;
  let currentAlign: 'left' | 'center' | 'right' = 'left';
  let lineBuffer: LineBufferItem[] = [];

  /**
   * Descarga el buffer de línea actual con la alineación correcta
   */
  function flushLine(): void {
    if (lineBuffer.length === 0) return;

    // Calcular ancho total de la línea
    let totalWidth = 0;
    for (const item of lineBuffer) {
      totalWidth += pdf.getTextWidth(item.text, item.style);
    }

    // Calcular X inicial basado en alineación
    let lineX = startX;
    if (currentAlign === 'center') {
      lineX = startX + (width - totalWidth) / 2;
    } else if (currentAlign === 'right') {
      lineX = startX + width - totalWidth;
    }

    // Renderizar todos los items de la línea
    for (const item of lineBuffer) {
      const result = pdf.addText(item.text, lineX, currentY, {
        ...item.style,
        marginX: startX,
      });
      if (result.pageBreak) {
        currentY = result.y;
        lineX = startX;
      } else {
        lineX += pdf.getTextWidth(item.text, item.style);
      }
    }

    lineBuffer = [];
  }

  /**
   * Mapea el nombre de fuente del CSS a la fuente PDF
   */
  function mapFontFamily(fontFamily: string): 'helvetica' | 'times' | 'courier' {
    const lower = fontFamily.toLowerCase();
    if (lower.includes('times')) return 'times';
    if (lower.includes('courier') || lower.includes('monospace')) return 'courier';
    return 'helvetica';
  }

  /**
   * Procesa recursivamente los nodos del DOM
   */
  function traverse(node: Node, inheritedStyle: TextOptions): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim() && !text.includes(' ')) return;

      const words = text.split(/(\s+)/);
      const style = { ...inheritedStyle };

      for (const word of words) {
        if (!word) continue;

        const textWidth = pdf.getTextWidth(word, style);

        // Verificar si necesitamos wrap a la siguiente línea
        let lineWidth = 0;
        for (const item of lineBuffer) {
          lineWidth += pdf.getTextWidth(item.text, item.style);
        }

        if (lineWidth + textWidth > width && lineBuffer.length > 0) {
          flushLine();
          currentY += (style.size || 12) * 1.5;
          currentX = startX;
        }

        lineBuffer.push({ text: word, style });
        currentX += textWidth;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const newStyle: TextOptions = { ...inheritedStyle };
      const computed = getComputedStyles(el);

      // Obtener alineación de texto
      if (computed.textAlign === 'center' || computed.textAlign === 'right') {
        currentAlign = computed.textAlign;
      } else {
        currentAlign = 'left';
      }

      // Aplicar estilos del elemento
      if (computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 700) {
        newStyle.style = newStyle.style === 'italic' ? 'bolditalic' : 'bold';
      }

      if (computed.fontStyle === 'italic') {
        newStyle.style = newStyle.style === 'bold' ? 'bolditalic' : 'italic';
      }

      if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
        newStyle.color = rgbToHex(computed.color);
      }

      const fontSize = parseFloat(computed.fontSize);
      if (fontSize) {
        newStyle.size = fontSize * 0.75; // Convertir px a pt aproximadamente
      }

      newStyle.font = mapFontFamily(computed.fontFamily);

      // Manejar elementos específicos
      switch (el.tagName) {
        case 'H1':
          flushLine();
          newStyle.size = 24;
          newStyle.style = 'bold';
          if (currentX > startX) {
            currentY += 28;
            currentX = startX;
          }
          currentY += 8;
          break;

        case 'H2':
          flushLine();
          newStyle.size = 20;
          newStyle.style = 'bold';
          if (currentX > startX) {
            currentY += 24;
            currentX = startX;
          }
          currentY += 6;
          break;

        case 'H3':
          flushLine();
          newStyle.size = 16;
          newStyle.style = 'bold';
          if (currentX > startX) {
            currentY += 20;
            currentX = startX;
          }
          currentY += 4;
          break;

        case 'CODE':
          newStyle.font = 'courier';
          newStyle.size = 10;
          break;

        case 'PRE':
          flushLine();
          newStyle.font = 'courier';
          newStyle.size = 10;
          if (currentX > startX) {
            currentY += 16;
            currentX = startX;
          }
          break;

        case 'BLOCKQUOTE':
          flushLine();
          newStyle.color = '#666666';
          currentX = startX + 30;
          if (currentY > startY) currentY += 8;
          break;
      }

      // Elementos de bloque - nueva línea antes
      if (['DIV', 'P', 'BR', 'H1', 'H2', 'H3', 'LI', 'PRE', 'BLOCKQUOTE'].includes(el.tagName)) {
        flushLine();
        if (currentX > startX && el.tagName !== 'BR') {
          currentY += (inheritedStyle.size || 12) * 1.5;
          currentX = startX;
        } else if (el.tagName === 'BR') {
          currentY += (inheritedStyle.size || 12) * 1.5;
          currentX = startX;
        }
      }

      // Items de lista
      if (el.tagName === 'LI') {
        lineBuffer.push({ text: '• ', style: inheritedStyle });
      }

      // Procesar hijos
      el.childNodes.forEach((child) => traverse(child, newStyle));

      // Elementos de bloque - nueva línea después
      if (['DIV', 'P', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'PRE', 'UL', 'OL'].includes(el.tagName)) {
        flushLine();
        currentY += (newStyle.size || 12) * 1.5;
        currentX = startX;
        // Espaciado extra después de párrafos y headings
        if (['P', 'H1', 'H2', 'H3'].includes(el.tagName)) {
          currentY += 4;
        }
      }

      // Resetear alineación después de elemento de bloque
      if (['DIV', 'P', 'H1', 'H2', 'H3'].includes(el.tagName)) {
        currentAlign = 'left';
      }
    }
  }

  // Comenzar el traversal
  traverse(tempDiv, {
    size: 12,
    font: 'helvetica',
    style: 'normal',
    color: '#000000',
  });

  // Descargar contenido restante
  flushLine();

  // Limpiar
  document.body.removeChild(tempDiv);

  return currentY + 20;
}

/**
 * Genera el PDF a partir del contenido del editor
 */
export async function generatePdfFromContent(
  content: string,
  headerText: string,
  footerText: string,
  _fileName?: string
): Promise<Blob> {
  const headerH = headerText ? 50 : 0;
  const footerH = footerText ? 50 : 0;

  const pdf = new PdfCreator({
    headerHeight: headerH,
    footerHeight: footerH,
    defaultHeader: headerText
      ? { text: headerText, align: 'center' }
      : undefined,
    defaultFooter: footerText
      ? {
          text: footerText.replace('{pageNumber}', ''),
          showPageNumbers: footerText.includes('{pageNumber}'),
          align: 'center',
        }
      : undefined,
  });

  const marginX = 40;
  const marginY = 40;
  const contentWidth = PAGE_DIMENSIONS.PDF_WIDTH - marginX * 2;
  const startY = headerH + marginY;

  await parseHtmlToPdf(pdf, content, marginX, startY, contentWidth);

  return pdf.getOutput();
}

/**
 * Descarga el PDF
 */
export function downloadPdf(blob: Blob, fileName: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
}
