/**
 * Motor de maquetación basado en el DOM.
 *
 * En lugar de reimplementar el ajuste de líneas, deja que el navegador maquete el HTML con los
 * mismos estilos del editor y mide dónde ha colocado cada palabra, imagen, fondo y borde.
 * Todas las coordenadas están en píxeles CSS, relativas a la esquina superior izquierda del
 * área de contenido (dentro del padding) del elemento raíz.
 */

export type PdfFontFamily = 'helvetica' | 'times' | 'courier';
export type PdfFontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

export interface TextRun {
  kind: 'text';
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Línea base, en px desde el borde superior del contenido */
  baseline: number;
  font: PdfFontFamily;
  style: PdfFontStyle;
  sizePx: number;
  color: string;
  /**
   * false = no ajustar el ancho al medido por el navegador; el texto se alinea a la derecha de
   * x + width (viñetas y números de lista).
   */
  fit?: boolean;
}

export interface ImageBox {
  kind: 'image';
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FillBox {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DecorationLine {
  x1: number;
  x2: number;
  y: number;
  thickness: number;
  color: string;
}

export interface LinkBox {
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
}

export interface HtmlLayout {
  /** Texto e imágenes: lo que no se puede partir entre páginas */
  atoms: (TextRun | ImageBox)[];
  fills: FillBox[];
  lines: DecorationLine[];
  links: LinkBox[];
}

export interface CollectOptions {
  /**
   * Incluye fondos, bordes, subrayados, enlaces y viñetas. Requiere poder insertar sondas
   * temporales en el árbol, así que solo debe usarse sobre una copia fuera de pantalla.
   */
  decorations?: boolean;
  /** Filtro de URLs para enlaces e imágenes */
  isAllowedUrl?: (url: string, kind: 'link' | 'image') => boolean;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(value: string): Rgba | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i.exec(value);
  if (!m) return null;
  let a = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4]?.endsWith('%')) a /= 100;
  return { r: +m[1], g: +m[2], b: +m[3], a };
}

function toHex(c: Rgba): string {
  // Mezcla con blanco cuando hay transparencia parcial (el fondo de página es blanco)
  const mix = (v: number) => Math.round(v * c.a + 255 * (1 - c.a));
  return '#' + [c.r, c.g, c.b].map(v => mix(v).toString(16).padStart(2, '0')).join('');
}

function visibleColor(value: string): string | null {
  const c = parseColor(value);
  return c && c.a > 0.01 ? toHex(c) : null;
}

export function mapFontFamily(fontFamily: string): PdfFontFamily {
  const lower = fontFamily.toLowerCase();
  if (/courier|mono|consolas|menlo/.test(lower)) return 'courier';
  if (/times|georgia|garamond|(^|[\s,"'])serif/.test(lower)) return 'times';
  return 'helvetica';
}

function fontStyleOf(cs: CSSStyleDeclaration): PdfFontStyle {
  const weight = parseInt(cs.fontWeight, 10);
  const bold = cs.fontWeight === 'bold' || weight >= 600;
  const italic = cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique');
  return bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
}

/** Distancia (px) entre el borde superior de la caja de texto y la línea base, por fuente */
class BaselineProbe {
  private cache = new Map<string, number>();
  private host: HTMLDivElement | null = null;

  constructor(private doc: Document) {}

  offset(cs: CSSStyleDeclaration): number {
    const key = `${cs.fontStyle}|${cs.fontWeight}|${cs.fontSize}|${cs.fontFamily}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    if (!this.host) {
      this.host = this.doc.createElement('div');
      this.host.setAttribute('aria-hidden', 'true');
      this.host.style.cssText =
        'position:fixed;left:-100000px;top:0;visibility:hidden;white-space:nowrap;line-height:normal;';
      this.doc.body.appendChild(this.host);
    }
    const span = this.doc.createElement('span');
    span.style.fontFamily = cs.fontFamily;
    span.style.fontSize = cs.fontSize;
    span.style.fontWeight = cs.fontWeight;
    span.style.fontStyle = cs.fontStyle;
    const text = this.doc.createTextNode('Hg');
    const marker = this.doc.createElement('span');
    marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
    span.append(text, marker);
    this.host.appendChild(span);

    const range = this.doc.createRange();
    range.selectNodeContents(text);
    const textTop = range.getBoundingClientRect().top;
    const offset = marker.getBoundingClientRect().top - textTop;
    span.remove();

    const value = Number.isFinite(offset) && offset > 0 ? offset : parseFloat(cs.fontSize) * 0.8;
    this.cache.set(key, value);
    return value;
  }

  dispose(): void {
    this.host?.remove();
    this.host = null;
  }
}

/**
 * Recorre `root` y devuelve la posición de todo lo que hay que dibujar.
 */
export function collectLayout(root: HTMLElement, options: CollectOptions = {}): HtmlLayout {
  const { decorations = false, isAllowedUrl = () => true } = options;
  const doc = root.ownerDocument;
  const win = doc.defaultView!;
  const rootCs = win.getComputedStyle(root);
  const rootRect = root.getBoundingClientRect();
  const originX = rootRect.left + parseFloat(rootCs.borderLeftWidth) + parseFloat(rootCs.paddingLeft);
  const originY = rootRect.top + parseFloat(rootCs.borderTopWidth) + parseFloat(rootCs.paddingTop);

  const layout: HtmlLayout = { atoms: [], fills: [], lines: [], links: [] };
  const probe = new BaselineProbe(doc);
  const range = doc.createRange();
  const styleCache = new Map<Element, CSSStyleDeclaration>();
  const csOf = (el: Element) => {
    let cs = styleCache.get(el);
    if (!cs) {
      cs = win.getComputedStyle(el);
      styleCache.set(el, cs);
    }
    return cs;
  };

  // Segmentos de subrayado/tachado y enlaces, agrupados por línea para dibujarlos continuos
  const segments = new Map<string, DecorationLine & { key: string }>();
  const linkSegments = new Map<string, LinkBox>();
  const extendSegment = (key: string, seg: DecorationLine) => {
    const prev = segments.get(key);
    if (prev) {
      prev.x1 = Math.min(prev.x1, seg.x1);
      prev.x2 = Math.max(prev.x2, seg.x2);
    } else {
      segments.set(key, { ...seg, key });
    }
  };

  const textDecorationsOf = (el: Element) => {
    let underline: string | null = null;
    let strike: string | null = null;
    for (let cur: Element | null = el; cur && cur !== root.parentElement; cur = cur.parentElement) {
      const cs = csOf(cur);
      const line = cs.textDecorationLine || cs.textDecoration;
      const color = visibleColor(cs.textDecorationColor || cs.color) ?? '#000000';
      if (!underline && line.includes('underline')) underline = color;
      if (!strike && line.includes('line-through')) strike = color;
      if (cur === root) break;
    }
    return { underline, strike };
  };

  const pushRun = (text: string, rect: DOMRect, el: Element, cs: CSSStyleDeclaration, nodeId: number) => {
    const color = visibleColor(cs.color);
    if (!color) return;
    const x = rect.left - originX;
    const y = rect.top - originY;
    const baseline = y + probe.offset(cs);
    const sizePx = parseFloat(cs.fontSize);
    layout.atoms.push({
      kind: 'text',
      text,
      x,
      y,
      width: rect.width,
      height: rect.height,
      baseline,
      font: mapFontFamily(cs.fontFamily),
      style: fontStyleOf(cs),
      sizePx,
      color,
    });

    if (!decorations) return;
    const lineKey = `${nodeId}:${Math.round(rect.top)}`;
    const { underline, strike } = textDecorationsOf(el);
    const thickness = Math.max(0.75, sizePx / 16);
    if (underline) {
      extendSegment(`u:${lineKey}`, { x1: x, x2: x + rect.width, y: baseline + sizePx * 0.12, thickness, color: underline });
    }
    if (strike) {
      extendSegment(`s:${lineKey}`, { x1: x, x2: x + rect.width, y: baseline - sizePx * 0.28, thickness, color: strike });
    }
    const anchor = el.closest('a[href]');
    if (anchor && root.contains(anchor)) {
      const href = (anchor as HTMLAnchorElement).href;
      if (href && isAllowedUrl(href, 'link')) {
        const key = `${lineKey}:${href}`;
        const prev = linkSegments.get(key);
        if (prev) {
          const right = Math.max(prev.x + prev.width, x + rect.width);
          prev.x = Math.min(prev.x, x);
          prev.width = right - prev.x;
        } else {
          linkSegments.set(key, { x, y, width: rect.width, height: rect.height, url: href });
        }
      }
    }
  };

  const collectText = (node: Text, nodeId: number) => {
    const el = node.parentElement;
    if (!el) return;
    const cs = csOf(el);
    if (cs.visibility === 'hidden') return;
    const data = node.data;
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(data))) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
      if (rects.length === 0) continue;
      if (rects.length === 1) {
        pushRun(m[0], rects[0], el, cs, nodeId);
        continue;
      }
      // Palabra partida entre líneas: medir carácter a carácter y reagrupar por línea
      let current: { text: string; rect: DOMRect } | null = null;
      for (let i = 0; i < m[0].length; i++) {
        range.setStart(node, m.index + i);
        range.setEnd(node, m.index + i + 1);
        const r = Array.from(range.getClientRects()).find(rr => rr.width > 0);
        if (!r) continue;
        if (current && Math.abs(current.rect.top - r.top) < 1) {
          current.text += m[0][i];
          current.rect = new DOMRect(current.rect.left, current.rect.top, r.right - current.rect.left, current.rect.height);
        } else {
          if (current) pushRun(current.text, current.rect, el, cs, nodeId);
          current = { text: m[0][i], rect: r };
        }
      }
      if (current) pushRun(current.text, current.rect, el, cs, nodeId);
    }
  };

  const collectBoxDecorations = (el: HTMLElement, cs: CSSStyleDeclaration) => {
    const bg = visibleColor(cs.backgroundColor);
    const isInline = cs.display === 'inline';
    if (bg) {
      const rects = isInline ? Array.from(el.getClientRects()) : [el.getBoundingClientRect()];
      for (const r of rects) {
        if (r.width > 0 && r.height > 0) {
          layout.fills.push({ x: r.left - originX, y: r.top - originY, width: r.width, height: r.height, color: bg });
        }
      }
    }
    if (isInline) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const x = r.left - originX;
    const y = r.top - originY;
    const side = (name: 'Top' | 'Right' | 'Bottom' | 'Left') => {
      const width = parseFloat(cs.getPropertyValue(`border-${name.toLowerCase()}-width`));
      const style = cs.getPropertyValue(`border-${name.toLowerCase()}-style`);
      const color = visibleColor(cs.getPropertyValue(`border-${name.toLowerCase()}-color`));
      if (!width || !color || style === 'none' || style === 'hidden') return;
      if (name === 'Top') layout.fills.push({ x, y, width: r.width, height: width, color });
      if (name === 'Bottom') layout.fills.push({ x, y: y + r.height - width, width: r.width, height: width, color });
      if (name === 'Left') layout.fills.push({ x, y, width, height: r.height, color });
      if (name === 'Right') layout.fills.push({ x: x + r.width - width, y, width, height: r.height, color });
    };
    side('Top');
    side('Right');
    side('Bottom');
    side('Left');
  };

  const collectListMarker = (li: HTMLElement, cs: CSSStyleDeclaration) => {
    const list = li.parentElement;
    if (!list || cs.display !== 'list-item' || cs.listStyleType === 'none') return;
    let label = '•';
    if (list.tagName === 'OL') {
      const ol = list as HTMLOListElement;
      const items = Array.from(ol.children).filter(c => c.tagName === 'LI');
      const index = items.indexOf(li);
      const value = li.getAttribute('value');
      label = `${value !== null ? parseInt(value, 10) : (ol.start || 1) + index}.`;
    }
    // Sonda temporal al inicio del elemento para conocer la línea base de su primera línea
    const marker = doc.createElement('span');
    marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
    li.insertBefore(marker, li.firstChild);
    const mr = marker.getBoundingClientRect();
    marker.remove();
    const liRect = li.getBoundingClientRect();
    const sizePx = parseFloat(cs.fontSize);
    const color = visibleColor(cs.color) ?? '#000000';
    const style = fontStyleOf(cs);
    const font = mapFontFamily(cs.fontFamily);
    // Ancho aproximado de la etiqueta (se recalcula con métricas exactas al dibujar)
    const approxWidth = sizePx * 0.55 * label.length;
    const gap = sizePx * 0.5;
    const baseline = mr.top - originY;
    const ascent = probe.offset(cs);
    layout.atoms.push({
      kind: 'text',
      text: label,
      x: liRect.left - originX - gap - approxWidth,
      y: baseline - ascent,
      width: approxWidth,
      height: sizePx * 1.2,
      baseline,
      font,
      style,
      sizePx,
      color,
      fit: false,
    });
  };

  try {
    let nodeId = 0;
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        collectText(node as Text, nodeId++);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const cs = csOf(el);
      if (cs.display === 'none') return;

      // Fondos y bordes solo leen el DOM: se recogen siempre porque afectan a la paginación
      if (el !== root) collectBoxDecorations(el, cs);

      if (el.tagName === 'IMG') {
        const img = el as HTMLImageElement;
        const r = img.getBoundingClientRect();
        const src = img.currentSrc || img.src;
        if (r.width > 0 && r.height > 0 && src && isAllowedUrl(src, 'image')) {
          layout.atoms.push({ kind: 'image', src, x: r.left - originX, y: r.top - originY, width: r.width, height: r.height });
        }
        return;
      }

      if (el.tagName === 'LI' && decorations) collectListMarker(el, cs);

      // Copia de los hijos: la sonda de viñetas modifica temporalmente el árbol
      Array.from(el.childNodes).forEach(walk);
    };
    walk(root);
  } finally {
    probe.dispose();
    range.detach?.();
  }

  layout.lines = Array.from(segments.values()).map(({ key: _key, ...line }) => line);
  layout.links = Array.from(linkSegments.values());
  return layout;
}

/**
 * Calcula dónde empieza cada página (en px del contenido). Nunca corta una línea: las cajas que
 * se solapan verticalmente se agrupan y la página salta al inicio del grupo que no cabe.
 */
export function paginate(
  layout: Pick<HtmlLayout, 'atoms'> & Partial<Pick<HtmlLayout, 'fills'>>,
  pageHeightPx: number
): number[] {
  const fills = layout.fills ?? [];
  const boxes = layout.atoms
    // Las imágenes más altas que una página se dibujan reducidas a una página
    .map(a => ({ top: a.y, bottom: a.y + (a.kind === 'image' ? Math.min(a.height, pageHeightPx) : a.height) }))
    .sort((a, b) => a.top - b.top);

  const groups: { top: number; bottom: number }[] = [];
  for (const b of boxes) {
    const last = groups[groups.length - 1];
    if (last && b.top < last.bottom - 1) {
      last.bottom = Math.max(last.bottom, b.bottom);
    } else {
      groups.push({ ...b });
    }
  }

  const breaks = [0];
  let pageTop = 0;
  let prevBottom = 0;
  for (const g of groups) {
    while (g.bottom - pageTop > pageHeightPx + 0.5) {
      if (g.top > pageTop + 0.5) {
        // La siguiente página empieza en el grupo... o antes, si el grupo está dentro de un
        // bloque con fondo/borde que empieza después de la última línea de esta página
        // (p. ej. el padding superior de un <pre>): así el bloque no queda partido.
        let start = g.top;
        for (const f of fills) {
          if (f.y < start && f.y >= prevBottom - 0.5 && f.y > pageTop + 0.5 && f.y + f.height > g.top) {
            start = f.y;
          }
        }
        pageTop = start;
      } else {
        // Más alto que una página entera: se corta por el límite
        pageTop += pageHeightPx;
      }
      breaks.push(pageTop);
    }
    prevBottom = g.bottom;
  }
  return breaks;
}

/** Índice de página para una coordenada Y (px del contenido) */
export function pageIndexFor(breaks: number[], y: number): number {
  let k = 0;
  while (k + 1 < breaks.length && breaks[k + 1] <= y + 0.5) k++;
  return k;
}
