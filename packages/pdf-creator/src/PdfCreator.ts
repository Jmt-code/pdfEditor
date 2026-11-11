import { FONT_METRICS } from './fontMetrics';

export type FontFamily = 'helvetica' | 'times' | 'courier';
export type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';
export type TextAlign = 'left' | 'center' | 'right';

export interface TextOptions {
  /** Font size in points. Default 12. */
  size?: number;
  /** 'helvetica' (default), 'times' or 'courier'. Unknown names fall back to helvetica. */
  font?: FontFamily | string;
  style?: FontStyle;
  /** Hex color, `#rrggbb` or `#rgb`. Default black. */
  color?: string;
  align?: TextAlign;
  /** Left/right margin used for alignment and for resetting X after an automatic page break. Default 40. */
  marginX?: number;
  underline?: boolean;
  strikethrough?: boolean;
  /** Horizontal scaling in percent (PDF `Tz` operator). Default 100. */
  horizontalScale?: number;
  /** Turns the drawn text into a clickable link. */
  link?: string;
}

export interface ImageOptions {
  /** Display width in points. */
  width: number;
  /** Display height in points. */
  height: number;
  /** @deprecated Ignored: the format is detected from the data. */
  format?: string;
}

export interface LineOptions {
  color?: string;
  /** Line width in points. Default 1. */
  width?: number;
}

export interface RectOptions {
  fill?: string;
  stroke?: string;
  /** Stroke width in points. Default 1. */
  lineWidth?: number;
}

export interface DefaultHeaderConfig {
  text?: string;
  align?: TextAlign;
  color?: string;
}

export interface DefaultFooterConfig {
  /** Footer text. Supports the `{pageNumber}` and `{totalPages}` placeholders. */
  text?: string;
  /** Appends "Page N" when the text has no `{pageNumber}` placeholder. Default true. */
  showPageNumbers?: boolean;
  align?: TextAlign;
  color?: string;
}

export interface PdfConfig {
  headerHeight?: number;
  footerHeight?: number;
  /** Called for every page when the PDF is built. Must draw synchronously (no addImage). */
  onHeader?: (doc: PdfCreator, pageNumber: number, totalPages: number) => void;
  /** Called for every page when the PDF is built. Must draw synchronously (no addImage). */
  onFooter?: (doc: PdfCreator, pageNumber: number, totalPages: number) => void;
  defaultHeader?: DefaultHeaderConfig;
  defaultFooter?: DefaultFooterConfig;
  /** Start a new page automatically when text/images overflow the bottom margin. Default true. */
  autoPageBreak?: boolean;
}

interface LinkAnnotation {
  rect: [number, number, number, number];
  url: string;
}

interface PageData {
  content: string[];
  fonts: Set<string>;
  images: Set<string>;
  links: LinkAnnotation[];
}

interface ImageEntry {
  bytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  colorSpace: 'DeviceRGB' | 'DeviceGray';
}

/** Standard 14 font keys, in resource order (F1..F12). */
const FONT_KEYS = [
  'helvetica', 'helvetica-bold', 'helvetica-italic', 'helvetica-bolditalic',
  'times', 'times-bold', 'times-italic', 'times-bolditalic',
  'courier', 'courier-bold', 'courier-italic', 'courier-bolditalic',
] as const;

const BASE_FONTS: Record<string, string> = {
  'helvetica': 'Helvetica',
  'helvetica-bold': 'Helvetica-Bold',
  'helvetica-italic': 'Helvetica-Oblique',
  'helvetica-bolditalic': 'Helvetica-BoldOblique',
  'times': 'Times-Roman',
  'times-bold': 'Times-Bold',
  'times-italic': 'Times-Italic',
  'times-bolditalic': 'Times-BoldItalic',
  'courier': 'Courier',
  'courier-bold': 'Courier-Bold',
  'courier-italic': 'Courier-Oblique',
  'courier-bolditalic': 'Courier-BoldOblique',
};

/** Unicode code points that WinAnsiEncoding places in 0x80..0x9F. */
const WIN_ANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/**
 * Encodes a JS string as WinAnsi bytes (one char per byte, 0..255).
 * Characters that WinAnsi cannot represent become '?'.
 */
export function encodeWinAnsi(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x09) out += ' ';
    else if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff)) out += ch;
    else if (WIN_ANSI_EXTRA[cp] !== undefined) out += String.fromCharCode(WIN_ANSI_EXTRA[cp]);
    else if (cp === 0x2212) out += '-';
    else out += '?';
  }
  return out;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

function hexToRgb(hex: string | undefined): [number, number, number] {
  if (!hex) return [0, 0, 0];
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function colorOp(hex: string | undefined, op: 'rg' | 'RG'): string {
  return `${hexToRgb(hex).map(fmt).join(' ')} ${op}`;
}

function escapePdfString(bytes: string): string {
  return bytes.replace(/[\\()]/g, m => '\\' + m);
}

function escapeUri(url: string): string {
  // URIs in PDF are byte strings: keep them ASCII and escape delimiters.
  const ascii = encodeURI(decodeURI_safe(url));
  return escapePdfString(ascii);
}

function decodeURI_safe(url: string): string {
  try { return decodeURI(url); } catch { return url; }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Reads width, height and component count from a baseline/progressive JPEG. */
export function readJpegInfo(bytes: Uint8Array): { width: number; height: number; components: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9],
      };
    }
    i += 2 + len;
  }
  return null;
}

/**
 * Zero-dependency PDF 1.7 generator.
 * Coordinates use a top-left origin in points (A4: 595.28 × 841.89); text Y is the baseline.
 */
export class PdfCreator {
  static readonly PAGE_WIDTH = 595.28;
  static readonly PAGE_HEIGHT = 841.89;

  private config: PdfConfig;
  private pages: PageData[] = [];
  private currentPageIndex = -1;
  private images = new Map<string, ImageEntry>();
  private imageKeysBySource = new Map<string, string>();
  /** When set, drawing goes here instead of the page (header/footer pass during build). */
  private overlay: { content: string[]; links: LinkAnnotation[] } | null = null;

  private readonly PAGE_WIDTH = PdfCreator.PAGE_WIDTH;
  private readonly PAGE_HEIGHT = PdfCreator.PAGE_HEIGHT;
  private readonly MAX_HEADER_HEIGHT = 200;
  private readonly MAX_FOOTER_HEIGHT = 200;

  private headerHeight: number;
  private footerHeight: number;

  constructor(config: PdfConfig = {}) {
    this.config = config;
    this.headerHeight = Math.max(0, Math.min(config.headerHeight || 0, this.MAX_HEADER_HEIGHT));
    this.footerHeight = Math.max(0, Math.min(config.footerHeight || 0, this.MAX_FOOTER_HEIGHT));
    this.addPage();
  }

  // ---------------------------------------------------------------- pages

  public addPage(): void {
    this.pages.push({ content: [], fonts: new Set(), images: new Set(), links: [] });
    this.currentPageIndex = this.pages.length - 1;
  }

  /** Makes page `index` (0-based) the target of subsequent drawing calls. */
  public setPage(index: number): void {
    if (index < 0 || index >= this.pages.length) {
      throw new RangeError(`Page index ${index} out of range (0..${this.pages.length - 1})`);
    }
    this.currentPageIndex = index;
  }

  public getPageCount(): number {
    return this.pages.length;
  }

  public getCurrentPageIndex(): number {
    return this.currentPageIndex;
  }

  public getPageSize(): { width: number; height: number } {
    return { width: this.PAGE_WIDTH, height: this.PAGE_HEIGHT };
  }

  /** Top and bottom Y (points from top) of the printable area, excluding header/footer. */
  public getContentArea(topMargin = 40, bottomMargin = 20): { top: number; bottom: number } {
    return {
      top: this.headerHeight + topMargin,
      bottom: this.PAGE_HEIGHT - this.footerHeight - bottomMargin,
    };
  }

  private get page(): PageData {
    return this.pages[this.currentPageIndex];
  }

  private emit(op: string): void {
    (this.overlay ? this.overlay.content : this.page.content).push(op);
  }

  private emitLink(link: LinkAnnotation): void {
    (this.overlay ? this.overlay.links : this.page.links).push(link);
  }

  private get autoPageBreak(): boolean {
    return this.config.autoPageBreak !== false && !this.overlay;
  }

  // ---------------------------------------------------------------- fonts

  private resolveFontKey(font: string | undefined, style: FontStyle | undefined): string {
    const familyRaw = (font || 'helvetica').toLowerCase();
    const family: FontFamily = familyRaw.includes('times') ? 'times'
      : familyRaw.includes('courier') ? 'courier'
      : 'helvetica';
    const s = (style || 'normal').toLowerCase();
    return s === 'normal' ? family : `${family}-${s}`;
  }

  private fontResource(fontKey: string): string {
    const idx = (FONT_KEYS as readonly string[]).indexOf(fontKey);
    return `F${(idx < 0 ? 0 : idx) + 1}`;
  }

  /** Width of `text` in points, using the exact metrics of the standard 14 fonts. */
  public getTextWidth(text: string, options: TextOptions = {}): number {
    const { size = 12, horizontalScale = 100 } = options;
    const metrics = FONT_METRICS[BASE_FONTS[this.resolveFontKey(options.font, options.style)]];
    const bytes = encodeWinAnsi(text);
    let units = 0;
    for (let i = 0; i < bytes.length; i++) {
      const code = bytes.charCodeAt(i);
      units += code >= 0x20 ? metrics.widths[code - 0x20] : 0;
    }
    return (units * size / 1000) * (horizontalScale / 100);
  }

  // ---------------------------------------------------------------- drawing

  public addText(
    text: string,
    x: number,
    y: number,
    options: TextOptions = {}
  ): { y: number; pageBreak: boolean; x: number } {
    const {
      size = 12, color = '#000000', align = 'left', marginX = 40,
      underline = false, strikethrough = false, horizontalScale = 100, link,
    } = options;

    let pageBreak = false;
    if (this.autoPageBreak && y + size * 0.25 > this.getContentArea().bottom) {
      this.addPage();
      y = this.getContentArea().top;
      x = marginX;
      pageBreak = true;
    }

    const fontKey = this.resolveFontKey(options.font, options.style);
    const resource = this.fontResource(fontKey);
    this.page.fonts.add(resource);

    const textWidth = this.getTextWidth(text, options);
    let drawX = x;
    if (align === 'center') {
      drawX = marginX + (this.PAGE_WIDTH - marginX * 2 - textWidth) / 2;
    } else if (align === 'right') {
      drawX = this.PAGE_WIDTH - marginX - textWidth;
    }

    const pdfY = this.PAGE_HEIGHT - y;
    // Tz forma parte del estado gráfico y no se reinicia con ET: se emite siempre
    const scaleOp = `${fmt(horizontalScale)} Tz `;
    this.emit(
      `BT /${resource} ${fmt(size)} Tf ${scaleOp}${colorOp(color, 'rg')} ` +
      `${fmt(drawX)} ${fmt(pdfY)} Td (${escapePdfString(encodeWinAnsi(text))}) Tj ET`
    );

    if (underline || strikethrough) {
      const metrics = FONT_METRICS[BASE_FONTS[fontKey]];
      const thickness = Math.max(0.5, (metrics.underlineThickness * size) / 1000);
      if (underline) {
        const uy = y - (metrics.underlinePosition * size) / 1000;
        this.addLine(drawX, uy, drawX + textWidth, uy, { color, width: thickness });
      }
      if (strikethrough) {
        const sy = y - size * 0.28;
        this.addLine(drawX, sy, drawX + textWidth, sy, { color, width: thickness });
      }
    }

    if (link) {
      this.addLink(drawX, y - size * 0.8, textWidth, size, link);
    }

    return { y, pageBreak, x: drawX + textWidth };
  }

  public addLine(x1: number, y1: number, x2: number, y2: number, options: LineOptions = {}): void {
    const { color = '#000000', width = 1 } = options;
    const H = this.PAGE_HEIGHT;
    this.emit(
      `q ${colorOp(color, 'RG')} ${fmt(width)} w ${fmt(x1)} ${fmt(H - y1)} m ${fmt(x2)} ${fmt(H - y2)} l S Q`
    );
  }

  /** Rectangle with its top-left corner at (x, y). */
  public addRect(x: number, y: number, width: number, height: number, options: RectOptions = {}): void {
    const { fill, stroke, lineWidth = 1 } = options;
    if (!fill && !stroke) return;
    const ops: string[] = ['q'];
    if (fill) ops.push(colorOp(fill, 'rg'));
    if (stroke) ops.push(colorOp(stroke, 'RG'), `${fmt(lineWidth)} w`);
    ops.push(`${fmt(x)} ${fmt(this.PAGE_HEIGHT - y - height)} ${fmt(width)} ${fmt(height)} re`);
    ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S', 'Q');
    this.emit(ops.join(' '));
  }

  /** Clickable URI area with its top-left corner at (x, y). */
  public addLink(x: number, y: number, width: number, height: number, url: string): void {
    if (!url) return;
    const H = this.PAGE_HEIGHT;
    this.emitLink({ rect: [x, H - y - height, x + width, H - y], url });
  }

  // ---------------------------------------------------------------- images

  private async toJpeg(source: string): Promise<ImageEntry> {
    let dataUrl = source;
    if (/^https?:\/\//i.test(source) || source.startsWith('blob:')) {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Failed to fetch image (${response.status}): ${source}`);
      const blob = await response.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }

    // Direct embedding of JPEG data (no quality loss, works without a DOM).
    const jpegMatch = /^data:image\/jpe?g;base64,(.*)$/is.exec(dataUrl);
    if (jpegMatch) {
      const bytes = base64ToBytes(jpegMatch[1]);
      const info = readJpegInfo(bytes);
      if (info && (info.components === 3 || info.components === 1)) {
        return {
          bytes,
          pixelWidth: info.width,
          pixelHeight: info.height,
          colorSpace: info.components === 1 ? 'DeviceGray' : 'DeviceRGB',
        };
      }
    }

    if (typeof document === 'undefined') {
      throw new Error('Only RGB/grayscale JPEG images can be embedded outside the browser');
    }

    // Other formats (PNG, GIF, WebP, CMYK JPEG...): re-encode to JPEG with a canvas.
    return new Promise<ImageEntry>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context not available'));
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
        resolve({
          bytes: base64ToBytes(b64),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          colorSpace: 'DeviceRGB',
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Draws an image with its top-left corner at (x, y), scaled to options.width × options.height points.
   * Accepts data URLs (any browser-decodable format) or http(s)/blob URLs.
   * Returns the Y actually used (it changes when an automatic page break happens).
   */
  public async addImage(imageData: string, x: number, y: number, options: ImageOptions): Promise<number> {
    // Fix the target page before awaiting, so concurrent page changes cannot move the image.
    if (this.autoPageBreak && y + options.height > this.getContentArea().bottom) {
      this.addPage();
      y = this.getContentArea().top;
    }
    const pageIndex = this.currentPageIndex;

    let key = this.imageKeysBySource.get(imageData);
    if (!key) {
      const entry = await this.toJpeg(imageData);
      key = `Im${this.images.size + 1}`;
      this.images.set(key, entry);
      this.imageKeysBySource.set(imageData, key);
    }

    const page = this.pages[pageIndex];
    page.images.add(key);
    const pdfY = this.PAGE_HEIGHT - y - options.height;
    page.content.push(`q ${fmt(options.width)} 0 0 ${fmt(options.height)} ${fmt(x)} ${fmt(pdfY)} cm /${key} Do Q`);
    return y;
  }

  // ---------------------------------------------------------------- header / footer

  private drawHeaderFooter(pageNumber: number, totalPages: number): void {
    const { onHeader, onFooter, defaultHeader, defaultFooter } = this.config;

    if (onHeader) {
      onHeader(this, pageNumber, totalPages);
    } else if (defaultHeader?.text) {
      const { text, align = 'center', color = '#000000' } = defaultHeader;
      const baseline = this.headerHeight > 0 ? this.headerHeight / 2 + 4 : 24;
      this.addText(text, 40, baseline, { size: 10, align, color });
    }

    if (onFooter) {
      onFooter(this, pageNumber, totalPages);
    } else if (defaultFooter) {
      const { text = '', showPageNumbers = true, align = 'center', color = '#000000' } = defaultFooter;
      let footerText = text;
      if (/\{(pageNumber|totalPages)\}/.test(text)) {
        footerText = text
          .replace(/\{pageNumber\}/g, String(pageNumber))
          .replace(/\{totalPages\}/g, String(totalPages));
      } else if (showPageNumbers) {
        footerText = text ? `${text} - Page ${pageNumber}` : `Page ${pageNumber}`;
      }
      if (footerText.trim()) {
        const baseline = this.PAGE_HEIGHT - (this.footerHeight > 0 ? this.footerHeight / 2 - 4 : 20);
        this.addText(footerText, 40, baseline, { size: 10, align, color });
      }
    }
  }

  // ---------------------------------------------------------------- serialization

  /**
   * Serializes the document. Pure with respect to the document: it can be called any number of
   * times and drawing can continue afterwards.
   */
  public toBytes(): Uint8Array {
    const total = this.pages.length;

    // 1. Header/footer drawn into per-build overlays (pages are not mutated).
    const overlays: { content: string[]; links: LinkAnnotation[]; fonts: Set<string> }[] = [];
    const savedPage = this.currentPageIndex;
    for (let i = 0; i < total; i++) {
      this.currentPageIndex = i;
      const fontsBefore = new Set(this.pages[i].fonts);
      this.overlay = { content: [], links: [] };
      try {
        this.drawHeaderFooter(i + 1, total);
      } finally {
        const ov = this.overlay!;
        this.overlay = null;
        // Fonts registered by the overlay must not leak into the page permanently.
        const fonts = new Set(this.pages[i].fonts);
        this.pages[i].fonts = fontsBefore;
        overlays.push({ ...ov, fonts });
      }
    }
    this.currentPageIndex = savedPage;

    // 2. Object numbering (local to this build).
    let nextId = 1;
    const catalogId = nextId++;
    const pagesId = nextId++;
    const fontIds = new Map<string, number>();
    const usedFonts = new Set<string>();
    overlays.forEach(o => o.fonts.forEach(f => usedFonts.add(f)));
    [...usedFonts].sort().forEach(f => fontIds.set(f, nextId++));
    const imageIds = new Map<string, number>();
    this.images.forEach((_, key) => imageIds.set(key, nextId++));
    const pageIds = this.pages.map(() => ({ page: nextId++, content: nextId++, annots: [] as number[] }));
    this.pages.forEach((p, i) => {
      const n = p.links.length + overlays[i].links.length;
      for (let k = 0; k < n; k++) pageIds[i].annots.push(nextId++);
    });
    const objectCount = nextId;

    // 3. Byte assembly with exact offsets.
    const chunks: Uint8Array[] = [];
    let length = 0;
    const offsets: number[] = new Array(objectCount).fill(0);
    const writeLatin1 = (s: string) => {
      const b = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
      chunks.push(b);
      length += b.length;
    };
    const writeBytes = (b: Uint8Array) => { chunks.push(b); length += b.length; };
    const startObj = (id: number) => { offsets[id] = length; writeLatin1(`${id} 0 obj\n`); };
    const obj = (id: number, body: string) => { startObj(id); writeLatin1(`${body}\nendobj\n`); };
    const stream = (id: number, dict: string, data: Uint8Array | string) => {
      const bytes = typeof data === 'string' ? Uint8Array.from(data, c => c.charCodeAt(0) & 0xff) : data;
      startObj(id);
      writeLatin1(`<< ${dict} /Length ${bytes.length} >>\nstream\n`);
      writeBytes(bytes);
      writeLatin1(`\nendstream\nendobj\n`);
    };

    writeLatin1('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n');
    obj(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    obj(pagesId, `<< /Type /Pages /Kids [${pageIds.map(p => `${p.page} 0 R`).join(' ')}] /Count ${total} >>`);

    usedFonts.forEach(res => {
      const key = FONT_KEYS[parseInt(res.slice(1), 10) - 1];
      obj(fontIds.get(res)!, `<< /Type /Font /Subtype /Type1 /BaseFont /${BASE_FONTS[key]} /Encoding /WinAnsiEncoding >>`);
    });

    this.images.forEach((img, key) => {
      stream(
        imageIds.get(key)!,
        `/Type /XObject /Subtype /Image /Width ${img.pixelWidth} /Height ${img.pixelHeight} ` +
          `/ColorSpace /${img.colorSpace} /BitsPerComponent 8 /Filter /DCTDecode`,
        img.bytes
      );
    });

    this.pages.forEach((page, i) => {
      const ov = overlays[i];
      const ids = pageIds[i];
      const fontRes = [...ov.fonts].sort().map(f => `/${f} ${fontIds.get(f)} 0 R`).join(' ');
      const imgRes = [...page.images].map(k => `/${k} ${imageIds.get(k)} 0 R`).join(' ');
      const resources =
        `<< /ProcSet [/PDF /Text /ImageB /ImageC]` +
        (fontRes ? ` /Font << ${fontRes} >>` : '') +
        (imgRes ? ` /XObject << ${imgRes} >>` : '') +
        ` >>`;
      const annots = ids.annots.length ? ` /Annots [${ids.annots.map(a => `${a} 0 R`).join(' ')}]` : '';
      obj(
        ids.page,
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${fmt(this.PAGE_WIDTH)} ${fmt(this.PAGE_HEIGHT)}] ` +
          `/Contents ${ids.content} 0 R /Resources ${resources}${annots} >>`
      );
      const background = `q 1 1 1 rg 0 0 ${fmt(this.PAGE_WIDTH)} ${fmt(this.PAGE_HEIGHT)} re f Q`;
      stream(ids.content, '', [background, ...page.content, ...ov.content].join('\n'));
      [...page.links, ...ov.links].forEach((link, k) => {
        obj(
          ids.annots[k],
          `<< /Type /Annot /Subtype /Link /Rect [${link.rect.map(fmt).join(' ')}] /Border [0 0 0] ` +
            `/A << /S /URI /URI (${escapeUri(link.url)}) >> >>`
        );
      });
    });

    const xrefOffset = length;
    let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
    for (let id = 1; id < objectCount; id++) {
      xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objectCount} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    writeLatin1(xref);

    const out = new Uint8Array(length);
    let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    return out;
  }

  public getOutput(): Blob {
    return new Blob([this.toBytes() as BlobPart], { type: 'application/pdf' });
  }

  public save(filename: string): void {
    const url = URL.createObjectURL(this.getOutput());
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
