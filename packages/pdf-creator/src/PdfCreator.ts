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
  /** Symmetric left/right margin used for center/right alignment. Default: the configured margins. */
  marginX?: number;
  underline?: boolean;
  strikethrough?: boolean;
  /** Horizontal scaling in percent (PDF `Tz` operator). Default 100. */
  horizontalScale?: number;
  /** Turns the drawn text into a clickable link. */
  link?: string;
  /** Overrides the document's autoPageBreak for this call (addText only). */
  autoPageBreak?: boolean;
}

/** An image loaded into a document with loadImage(). */
export interface PdfImage {
  id: string;
  pixelWidth: number;
  pixelHeight: number;
}

export interface ImageOptions {
  /** Overrides the document's autoPageBreak for this call. */
  autoPageBreak?: boolean;
  /** Display width in points. */
  width: number;
  /** Display height in points. */
  height: number;
  /** @deprecated Ignored: the format is detected from the data. */
  format?: string;
  /**
   * Scale the image down (keeping its aspect ratio, never enlarging) so it fits in the printable
   * height and in the width left up to the right margin. The resulting bottom is reflected in
   * `cursorY`. Default false: the image is drawn exactly at the given size.
   */
  fit?: boolean;
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

/** Default header/footer text is aligned between the left and right page margins (like Word). */
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

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type PageSizeName = 'A4' | 'A5' | 'Letter' | 'Legal';

/** Page sizes in points (portrait). */
export const PAGE_SIZES: Record<PageSizeName, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
};

export interface ParagraphOptions extends Omit<TextOptions, 'align' | 'marginX'> {
  /** Left edge in points. Default: left margin. */
  x?: number;
  /** Top of the paragraph in points. Default: the current cursor. */
  y?: number;
  /** Maximum line width in points. Default: from x to the right margin. */
  maxWidth?: number;
  /** Line height as a multiple of the font size. Default 1.2. */
  lineHeight?: number;
  align?: TextAlign | 'justify';
  /** Extra space after the paragraph, in points. Default 0. */
  spacingAfter?: number;
}

export interface ParagraphResult {
  /** Y just below the paragraph (where the cursor is left). */
  y: number;
  lines: number;
  /** Pages added while drawing the paragraph. */
  pagesAdded: number;
}

export interface PdfConfig {
  /** Page size. Default 'A4'. */
  pageSize?: PageSizeName | { width: number; height: number };
  /** Default 'portrait'. */
  orientation?: 'portrait' | 'landscape';
  /** Page margins in points. Default { top: 40, right: 40, bottom: 20, left: 40 }. */
  margins?: Partial<Margins>;
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
  /** Saved cursor while another page is current. */
  cursor: number;
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
  /** @deprecated A4 width only. Use `getPageSize()`: pages can be other sizes/orientations. */
  static readonly PAGE_WIDTH = 595.28;
  /** @deprecated A4 height only. Use `getPageSize()`: pages can be other sizes/orientations. */
  static readonly PAGE_HEIGHT = 841.89;

  private config: PdfConfig;
  private pages: PageData[] = [];
  private currentPageIndex = -1;
  private images = new Map<string, ImageEntry>();
  private imageKeysBySource = new Map<string, string>();
  /** When set, drawing goes here instead of the page (header/footer pass during build). */
  private overlay: { content: string[]; links: LinkAnnotation[]; images: Set<string> } | null = null;

  private readonly PAGE_WIDTH: number;
  private readonly PAGE_HEIGHT: number;
  private readonly MAX_HEADER_HEIGHT = 200;
  private readonly MAX_FOOTER_HEIGHT = 200;

  private headerHeight: number;
  private footerHeight: number;
  private margins: Margins;
  /** Y (points from top) where the next flowing element goes on the current page. */
  private cursor = 0;

  constructor(config: PdfConfig = {}) {
    // Copy: never mutate the caller's config object
    this.config = { ...config };
    let base: { width: number; height: number };
    if (typeof config.pageSize === 'object' && config.pageSize !== null) {
      base = config.pageSize;
    } else {
      const name = String(config.pageSize ?? 'A4').toLowerCase();
      const key = (Object.keys(PAGE_SIZES) as PageSizeName[]).find(k => k.toLowerCase() === name);
      if (!key) {
        throw new RangeError(
          `Unknown pageSize "${config.pageSize}" (use ${Object.keys(PAGE_SIZES).join(', ')} or { width, height })`
        );
      }
      base = PAGE_SIZES[key];
    }
    const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;
    if (!valid(base?.width) || !valid(base?.height)) {
      throw new RangeError('pageSize width and height must be positive finite numbers (points)');
    }
    const [w, h] = [base.width, base.height];
    // An explicit orientation puts the long side horizontal ('landscape') or vertical
    // ('portrait'); without it, custom sizes are kept as given and named sizes are portrait.
    const orientation = config.orientation ?? (typeof config.pageSize === 'object' ? undefined : 'portrait');
    this.PAGE_WIDTH = orientation === 'landscape' ? Math.max(w, h) : orientation === 'portrait' ? Math.min(w, h) : w;
    this.PAGE_HEIGHT = orientation === 'landscape' ? Math.min(w, h) : orientation === 'portrait' ? Math.max(w, h) : h;
    this.headerHeight = Math.max(0, Math.min(config.headerHeight || 0, this.MAX_HEADER_HEIGHT));
    this.footerHeight = Math.max(0, Math.min(config.footerHeight || 0, this.MAX_FOOTER_HEIGHT));
    const m = config.margins ?? {};
    const clamp = (v: number | undefined, d: number) => Math.max(0, Number.isFinite(v) ? (v as number) : d);
    this.margins = {
      top: clamp(m.top, 40),
      right: clamp(m.right, 40),
      bottom: clamp(m.bottom, 20),
      left: clamp(m.left, 40),
    };
    const area = this.getContentArea();
    if (area.bottom - area.top < 1 || area.right - area.left < 1) {
      throw new RangeError(
        'Margins, headerHeight and footerHeight leave no printable area on a ' +
          `${fmt(this.PAGE_WIDTH)}×${fmt(this.PAGE_HEIGHT)} page`
      );
    }
    this.addPage();
  }

  // ---------------------------------------------------------------- pages

  public addPage(): void {
    this.assertNotInCallback('addPage');
    this.insertPage(this.pages.length);
  }

  private assertNotInCallback(method: string): void {
    if (this.overlay) throw new Error(`${method}() cannot be used inside onHeader/onFooter callbacks`);
  }

  /** Creates an empty page at `index` and makes it current (saving the current page's cursor). */
  private insertPage(index: number): void {
    if (this.page) this.page.cursor = this.cursor;
    const top = this.getContentArea().top;
    this.pages.splice(index, 0, { content: [], fonts: new Set(), images: new Set(), links: [], cursor: top });
    this.currentPageIndex = index;
    this.cursor = top;
  }

  /** Makes page `index` (0-based) the target of subsequent drawing calls (with its own cursor). */
  public setPage(index: number): void {
    this.assertNotInCallback('setPage');
    if (index < 0 || index >= this.pages.length) {
      throw new RangeError(`Page index ${index} out of range (0..${this.pages.length - 1})`);
    }
    if (index !== this.currentPageIndex) {
      this.page.cursor = this.cursor;
      this.currentPageIndex = index;
      this.cursor = this.page.cursor;
    }
  }

  /** Enables/disables automatic page breaks (same as the `autoPageBreak` config option). */
  public setAutoPageBreak(enabled: boolean): void {
    this.config.autoPageBreak = enabled;
  }

  public isAutoPageBreak(): boolean {
    return this.config.autoPageBreak !== false;
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

  public getMargins(): Margins {
    return { ...this.margins };
  }

  /**
   * Top and bottom Y (points from top) of the printable area, excluding header/footer and
   * margins. The optional arguments override the configured top/bottom margins.
   */
  public getContentArea(
    topMargin = this.margins.top,
    bottomMargin = this.margins.bottom
  ): { top: number; bottom: number; left: number; right: number } {
    return {
      top: this.headerHeight + topMargin,
      bottom: this.PAGE_HEIGHT - this.footerHeight - bottomMargin,
      left: this.margins.left,
      right: this.PAGE_WIDTH - this.margins.right,
    };
  }

  /** Y (points from top) where the next flowing element (paragraph, image...) will be placed. */
  public get cursorY(): number {
    return this.cursor;
  }

  /** Moves the cursor to `y` on the current page. */
  public setCursor(y: number): void {
    this.cursor = y;
  }

  /** Moves the cursor down by `points`, starting a new page if it passes the bottom margin. */
  public moveDown(points: number): void {
    this.cursor += points;
    if (this.autoPageBreak && this.cursor > this.getContentArea().bottom) this.insertPage(this.currentPageIndex + 1);
  }

  /**
   * Automatic page break rule shared by every flowing element: an element extending `above`
   * points over and `below` points under its reference Y moves to the top of a new page when
   * it crosses the bottom margin, unless it is already at the top (an element taller than the
   * printable area would otherwise open pages forever).
   * Callers must continue from the returned Y (or use addParagraph / cursorY): positions
   * computed for a previous page are not translated.
   */
  private placeFlowing(
    y: number,
    above: number,
    below: number,
    allowBreak = true
  ): { y: number; pageBreak: boolean } {
    if (!allowBreak || !this.autoPageBreak) return { y, pageBreak: false };
    const { top, bottom } = this.getContentArea();
    if (y + below > bottom && y - above > top + 0.01) {
      // Continue on a new page inserted right after the current one (also after setPage())
      this.insertPage(this.currentPageIndex + 1);
      const newY = this.getContentArea().top + above;
      // The element now opens the page: flowing content continues below it
      this.cursor = newY + below;
      return { y: newY, pageBreak: true };
    }
    return { y, pageBreak: false };
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

  /**
   * Draws one line of text with its baseline at y. If it crosses the bottom margin (and
   * automatic page breaks are on) it moves to the top of a new page, keeping x; continue from
   * the returned `y` (and `x`, the end of the text). It does not move the flowing cursor,
   * except after an automatic page break, which leaves the cursor just below the moved line.
   */
  public addText(
    text: string,
    x: number,
    y: number,
    options: TextOptions = {}
  ): { y: number; pageBreak: boolean; x: number } {
    const {
      size = 12, color = '#000000', align = 'left',
      horizontalScale = 100,
    } = options;
    // marginX (legacy) = symmetric margins; otherwise the configured left/right margins
    const left = options.marginX ?? this.margins.left;
    const right = this.PAGE_WIDTH - (options.marginX ?? this.margins.right);

    const placed = this.placeFlowing(y, size * 0.8, size * 0.25, options.autoPageBreak !== false);
    const pageBreak = placed.pageBreak;
    y = placed.y;

    const textWidth = this.getTextWidth(text, options);
    let drawX = x;
    if (align === 'center') {
      drawX = left + (right - left - textWidth) / 2;
    } else if (align === 'right') {
      drawX = right - textWidth;
    }

    const width = this.drawRun(text, drawX, y, { ...options, size, color, horizontalScale }, 0, textWidth);
    return { y, pageBreak, x: drawX + width };
  }

  /**
   * Low-level text drawing: one text object at (x, baseline), no pagination. `wordSpacing` is
   * the extra space (points) added to every space character (used to justify).
   * Returns the drawn width.
   */
  private drawRun(
    text: string,
    x: number,
    baseline: number,
    options: TextOptions,
    wordSpacing = 0,
    naturalWidth = this.getTextWidth(text, options)
  ): number {
    const size = options.size ?? 12;
    const color = options.color ?? '#000000';
    const scale = options.horizontalScale ?? 100;
    const resource = this.fontResource(this.resolveFontKey(options.font, options.style));
    this.page.fonts.add(resource);
    const bytes = encodeWinAnsi(text);
    // Tz and Tw are part of the graphics state and survive ET: always set both.
    // Tw is in unscaled text space, so it is divided by the horizontal scaling.
    this.emit(
      `BT /${resource} ${fmt(size)} Tf ${fmt(scale)} Tz ${fmt(wordSpacing / (scale / 100))} Tw ` +
      `${colorOp(color, 'rg')} ${fmt(x)} ${fmt(this.PAGE_HEIGHT - baseline)} Td (${escapePdfString(bytes)}) Tj ET`
    );
    const spaces = bytes.split(' ').length - 1;
    const width = naturalWidth + wordSpacing * spaces;
    this.decorate(x, baseline, width, { ...options, size, color });
    return width;
  }

  /** Underline, strikethrough and link area for a run of text whose baseline is `baseline`. */
  private decorate(x: number, baseline: number, width: number, options: TextOptions): void {
    const size = options.size ?? 12;
    const color = options.color ?? '#000000';
    if (options.underline || options.strikethrough) {
      const metrics = FONT_METRICS[BASE_FONTS[this.resolveFontKey(options.font, options.style)]];
      const thickness = Math.max(0.5, (metrics.underlineThickness * size) / 1000);
      if (options.underline) {
        const uy = baseline - (metrics.underlinePosition * size) / 1000;
        this.addLine(x, uy, x + width, uy, { color, width: thickness });
      }
      if (options.strikethrough) {
        const sy = baseline - size * 0.28;
        this.addLine(x, sy, x + width, sy, { color, width: thickness });
      }
    }
    if (options.link) this.addLink(x, baseline - size * 0.8, width, size, options.link);
  }

  /**
   * Splits `text` into lines that fit in `maxWidth` points. Respects `\n`, breaks between words
   * and, for words longer than a line, between characters.
   */
  public wrapText(text: string, maxWidth: number, options: TextOptions = {}): string[] {
    return this.wrapLines(text, maxWidth, options).map(l => l.text);
  }

  /**
   * Like wrapText, marking the last line of each source line (before `\n`) and returning each
   * line's width. Leading indentation (when it fits with the first word) and repeated spaces are
   * kept (tabs = 4 spaces); spaces at an automatic wrap point are dropped.
   */
  private wrapLines(text: string, maxWidth: number, options: TextOptions): { text: string; end: boolean; width: number }[] {
    const lines: { text: string; end: boolean; width: number }[] = [];
    const width = (s: string) => this.getTextWidth(s, options);
    for (const rawLine of text.replace(/\r\n?/g, '\n').split('\n')) {
      const tokens = rawLine.replace(/\t/g, '    ').split(/( +)/).filter(t => t !== '');
      let current = '';
      let currentWidth = 0;
      let pendingSpace = '';
      let wrapped = false; // an automatic wrap happened in this source line
      for (let token of tokens) {
        if (token[0] === ' ') {
          pendingSpace += token;
          continue;
        }
        // Leading indentation is kept only at the start of the source line
        const gap = current || !wrapped ? pendingSpace : '';
        pendingSpace = '';
        let tokenWidth = width(token);
        const gapWidth = gap ? width(gap) : 0;
        if (currentWidth + gapWidth + tokenWidth <= maxWidth) {
          current += gap + token;
          currentWidth += gapWidth + tokenWidth;
          continue;
        }
        if (current) {
          lines.push({ text: current, end: false, width: currentWidth });
          wrapped = true;
        }
        current = '';
        currentWidth = 0;
        // Word longer than a line: split it by characters, summing widths (linear)
        while (tokenWidth > maxWidth && token.length > 1) {
          let cutAt = 0;
          let acc = 0;
          for (const ch of token) {
            const w = width(ch);
            if (cutAt > 0 && acc + w > maxWidth) break;
            acc += w;
            cutAt += ch.length;
          }
          lines.push({ text: token.slice(0, cutAt), end: false, width: acc });
          wrapped = true;
          token = token.slice(cutAt);
          tokenWidth -= acc; // widths are additive per character: no re-measuring
        }
        current = token;
        currentWidth = tokenWidth;
      }
      if (current) {
        lines.push({ text: current, end: true, width: currentWidth });
      } else if (wrapped) {
        // The last piece of a split word consumed everything: it is the line end
        lines[lines.length - 1].end = true;
      } else {
        lines.push({ text: '', end: true, width: 0 });
      }
    }
    return lines;
  }

  /**
   * Draws a block of text with automatic line wrapping and page breaks, starting at the cursor
   * (or `options.y`, the top of the block). Leaves the cursor below the paragraph.
   */
  public addParagraph(text: string, options: ParagraphOptions = {}): ParagraphResult {
    const {
      x: optX, y: optY, maxWidth: optMaxWidth, lineHeight = 1.2, align = 'left', spacingAfter = 0,
      ...rest
    } = options;
    const size = rest.size ?? 12;
    const textOptions: TextOptions = { ...rest, size };
    const area = this.getContentArea();
    const x = optX ?? area.left;
    const maxWidth = Math.max(1, optMaxWidth ?? area.right - x);
    const lineAdvance = size * lineHeight;
    const ascent = size * 0.8;

    const lines = this.wrapLines(text, maxWidth, textOptions);
    const startPages = this.pages.length;
    let top = optY ?? this.cursor;

    for (const line of lines) {
      if (!line.text) {
        // Blank lines take vertical space but never start a page by themselves
        top += lineAdvance;
        continue;
      }
      // Same break rule as addText (no break without autoPageBreak or inside header/footer)
      const baseline = this.placeFlowing(top + ascent, ascent, size * 0.25, rest.autoPageBreak !== false).y;
      top = baseline - ascent;
      const w = line.width;
      const indent = /^ */.exec(line.text)![0];
      const body = line.text.slice(indent.length);
      const spaces = body.split(' ').length - 1;
      if (align === 'justify' && !line.end && spaces > 0) {
        // Only the gaps between words stretch; the indentation keeps its natural width
        const indentWidth = indent ? this.getTextWidth(indent, textOptions) : 0;
        const bodyWidth = w - indentWidth;
        this.drawRun(body, x + indentWidth, baseline, textOptions, (maxWidth - w) / spaces, bodyWidth);
      } else {
        const dx = align === 'center' ? (maxWidth - w) / 2 : align === 'right' ? maxWidth - w : 0;
        this.drawRun(line.text, x + dx, baseline, textOptions, 0, w);
      }
      top += lineAdvance;
    }

    const endY = top + spacingAfter;
    const pagesAdded = this.pages.length - startPages;
    // A paragraph placed higher up with an explicit y (e.g. a second column) must not move the
    // cursor back. (Header/footer callbacks run with a temporary cursor restored by toBytes.)
    this.cursor = optY === undefined || pagesAdded > 0 ? endY : Math.max(this.cursor, endY);
    return { y: endY, lines: lines.length, pagesAdded };
  }

  public addLine(x1: number, y1: number, x2: number, y2: number, options: LineOptions = {}): void {
    const { color = '#000000', width = 1 } = options;
    const H = this.PAGE_HEIGHT;
    this.emit(
      `q ${colorOp(color, 'RG')} ${fmt(width)} w ${fmt(x1)} ${fmt(H - y1)} m ${fmt(x2)} ${fmt(H - y2)} l S Q`
    );
  }

  /** Rectangle with its top-left corner at (x, y). Drawn exactly where given (never breaks pages). */
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
   * Loads (and if needed converts to JPEG) an image once, so it can be drawn synchronously any
   * number of times with drawImage(). Accepts data URLs or http(s)/blob URLs.
   */
  public async loadImage(source: string): Promise<PdfImage> {
    let key = this.imageKeysBySource.get(source);
    if (!key) {
      const entry = await this.toJpeg(source);
      key = this.imageKeysBySource.get(source); // another call may have loaded it meanwhile
      if (!key) {
        key = `Im${this.images.size + 1}`;
        this.images.set(key, entry);
        this.imageKeysBySource.set(source, key);
      }
    }
    const entry = this.images.get(key)!;
    return { id: key, pixelWidth: entry.pixelWidth, pixelHeight: entry.pixelHeight };
  }

  /** Display size after applying `fit`. */
  private imageSize(x: number, options: ImageOptions): { width: number; height: number } {
    let { width, height } = options;
    if (options.fit && width > 0 && height > 0) {
      // Reduce (never enlarge) to the printable height and to the room left to the right margin
      const area = this.getContentArea();
      let scale = Math.min(1, (area.bottom - area.top) / height);
      if (area.right - x > 0) scale = Math.min(scale, (area.right - x) / width);
      width *= scale;
      height *= scale;
    }
    return { width, height };
  }

  /**
   * Resolves the final page and position of an image (page break if needed). With
   * `y === 'cursor'` the image flows: it is placed at the cursor, which then moves below it.
   */
  private reserveImage(x: number, y: number | 'cursor', options: ImageOptions) {
    const { width, height } = this.imageSize(x, options);
    const flowing = y === 'cursor';
    const placed = this.placeFlowing(flowing ? this.cursor : y, 0, height, options.autoPageBreak !== false);
    if (flowing) this.cursor = placed.y + height;
    return { page: this.page, x, y: placed.y, width, height };
  }

  private paintImage(page: PageData, image: PdfImage, x: number, y: number, width: number, height: number): void {
    if (!this.images.has(image.id)) throw new Error(`Image ${image.id} does not belong to this document`);
    (this.overlay && page === this.page ? this.overlay.images : page.images).add(image.id);
    const op = `q ${fmt(width)} 0 0 ${fmt(height)} ${fmt(x)} ${fmt(this.PAGE_HEIGHT - y - height)} cm /${image.id} Do Q`;
    if (this.overlay && page === this.page) this.overlay.content.push(op);
    else page.content.push(op);
  }

  /**
   * Draws a loaded image (see loadImage) with its top-left corner at (x, y), scaled to
   * options.width × options.height points. Synchronous. Pass `'cursor'` as y to place it at the
   * cursor and move the cursor below it. Returns the Y actually used.
   */
  public drawImage(image: PdfImage, x: number, y: number | 'cursor', options: ImageOptions): number {
    const r = this.reserveImage(x, y, options);
    this.paintImage(r.page, image, r.x, r.y, r.width, r.height);
    return r.y;
  }

  /**
   * Loads and draws an image in one call. Its page and position (including any automatic page
   * break) are decided when addImage is called, so concurrent calls keep their order; the image
   * is painted when it has loaded. If loading fails the promise rejects and the reserved space
   * (and page break, if one was needed) stays. Pass `'cursor'` as y to flow at the cursor.
   * Returns the Y actually used.
   */
  public async addImage(imageData: string, x: number, y: number | 'cursor', options: ImageOptions): Promise<number> {
    const r = this.reserveImage(x, y, options);
    const image = await this.loadImage(imageData);
    this.paintImage(r.page, image, r.x, r.y, r.width, r.height);
    return r.y;
  }

  // ---------------------------------------------------------------- header / footer

  private drawHeaderFooter(pageNumber: number, totalPages: number): void {
    const { onHeader, onFooter, defaultHeader, defaultFooter } = this.config;

    if (onHeader) {
      onHeader(this, pageNumber, totalPages);
    } else if (defaultHeader?.text) {
      const { text, align = 'center', color = '#000000' } = defaultHeader;
      const baseline = this.headerHeight > 0 ? this.headerHeight / 2 + 4 : 24;
      this.addText(text, this.margins.left, baseline, { size: 10, align, color });
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
        this.addText(footerText, this.margins.left, baseline, { size: 10, align, color });
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
    const overlays: { content: string[]; links: LinkAnnotation[]; images: Set<string>; fonts: Set<string> }[] = [];
    const savedPage = this.currentPageIndex;
    const savedCursor = this.cursor;
    try {
      for (let i = 0; i < total; i++) {
        this.currentPageIndex = i;
        // Callbacks get a throw-away cursor at the top of the page; the body cursor is restored
        this.cursor = 0;
        const fontsBefore = new Set(this.pages[i].fonts);
        this.overlay = { content: [], links: [], images: new Set() };
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
    } finally {
      // Restore even if a header/footer callback throws
      this.currentPageIndex = savedPage;
      this.cursor = savedCursor;
    }

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
      const imgRes = [...new Set([...page.images, ...ov.images])].map(k => `/${k} ${imageIds.get(k)} 0 R`).join(' ');
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
