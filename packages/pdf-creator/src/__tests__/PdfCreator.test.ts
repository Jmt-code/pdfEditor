import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfCreator, encodeWinAnsi, readJpegInfo } from '../index';

// 3x2 px red JPEG (baseline, 3 components), generated with jpeg-js.
const RED_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAAIAAwMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APEq/Kj+/T//2Q==';

async function load(bytes: Uint8Array) {
  return getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
}

async function pageText(bytes: Uint8Array, pageNumber: number): Promise<string> {
  const doc = await load(bytes);
  const page = await doc.getPage(pageNumber);
  const tc = await page.getTextContent();
  return tc.items.map((it: any) => it.str).join(' ').replace(/\s+/g, ' ').trim();
}

function asText(bytes: Uint8Array): string {
  return Array.from(bytes, b => String.fromCharCode(b)).join('');
}

describe('encodeWinAnsi', () => {
  it('keeps Latin-1, maps WinAnsi extras and replaces the rest', () => {
    expect(encodeWinAnsi('ñá€“”')).toBe('\xf1\xe1\x80\x93\x94');
    expect(encodeWinAnsi('日本😀')).toBe('???');
  });
});

describe('PdfCreator', () => {
  it('produces a valid PDF whose xref offsets point at each object', () => {
    const pdf = new PdfCreator();
    pdf.addText('Hello', 40, 80);
    const bytes = pdf.toBytes();
    const text = asText(bytes);
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
    entries.forEach((offset, i) => {
      expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true);
    });
  });

  it('can be serialized repeatedly without changing the document', async () => {
    const pdf = new PdfCreator({ defaultHeader: { text: 'Header' }, defaultFooter: { text: 'Page {pageNumber} of {totalPages}' }, headerHeight: 50, footerHeight: 50 });
    pdf.addText('Body', 40, 120);
    const a = pdf.toBytes();
    const b = pdf.toBytes();
    pdf.getOutput();
    expect(asText(b)).toBe(asText(a));
    const text = await pageText(b, 1);
    expect(text.match(/Header/g)).toHaveLength(1);
    expect(text).toContain('Page 1 of 1');
  });

  it('renders Spanish accents, ñ and € correctly', async () => {
    const pdf = new PdfCreator();
    pdf.addText('Año: canción, pingüino — 12 €', 40, 80);
    expect(await pageText(pdf.toBytes(), 1)).toBe('Año: canción, pingüino — 12 €');
  });

  it('declares WinAnsiEncoding and never emits an undefined font', () => {
    const pdf = new PdfCreator();
    pdf.addText('x', 40, 80, { font: 'Arial', style: 'bold' });
    const text = asText(pdf.toBytes());
    expect(text).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    expect(text).not.toContain('undefined');
  });

  it('measures text in points with the standard font metrics', () => {
    const pdf = new PdfCreator();
    // Helvetica "A" = 667/1000 em; Courier is monospaced 600/1000 em.
    expect(pdf.getTextWidth('A', { size: 10 })).toBeCloseTo(6.67, 5);
    expect(pdf.getTextWidth('abc', { size: 10, font: 'courier' })).toBeCloseTo(18, 5);
  });

  it('breaks pages automatically and footer page numbers follow', async () => {
    const pdf = new PdfCreator({ defaultFooter: { text: 'Página {pageNumber}' }, footerHeight: 40 });
    let y = 60;
    for (let i = 0; i < 80; i++) {
      const r = pdf.addText(`Línea ${i}`, 40, y);
      y = r.y + 18;
    }
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    const bytes = pdf.toBytes();
    const doc = await load(bytes);
    expect(doc.numPages).toBe(pdf.getPageCount());
    expect(await pageText(bytes, 2)).toContain('Página 2');
  });

  it('embeds JPEG images with their pixel size, not the display size', async () => {
    expect(readJpegInfo(Uint8Array.from(atob(RED_JPEG.split(',')[1]), c => c.charCodeAt(0)))).toEqual({ width: 3, height: 2, components: 3 });
    const pdf = new PdfCreator();
    await pdf.addImage(RED_JPEG, 40, 40, { width: 200, height: 100 });
    await pdf.addImage(RED_JPEG, 40, 200, { width: 50, height: 50 });
    const text = asText(pdf.toBytes());
    expect(text).toContain('/Width 3 /Height 2 /ColorSpace /DeviceRGB');
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(1); // same source → one XObject
    expect(text).toContain('200 0 0 100 40');
    await load(pdf.toBytes());
  });

  it('adds link annotations, underline and shapes', async () => {
    const pdf = new PdfCreator();
    pdf.addText('Enlace', 40, 80, { link: 'https://example.com/a b', underline: true });
    pdf.addRect(40, 100, 100, 20, { fill: '#eee', stroke: '#000' });
    pdf.addLine(40, 130, 200, 130);
    const bytes = pdf.toBytes();
    const doc = await load(bytes);
    const annots = await (await doc.getPage(1)).getAnnotations();
    expect(annots).toHaveLength(1);
    expect(annots[0].url).toBe('https://example.com/a%20b');
  });

  it('does not leak horizontal scaling into later text', async () => {
    const pdf = new PdfCreator();
    pdf.addText('AAAA', 40, 80, { size: 10, horizontalScale: 50 });
    pdf.addText('AAAA', 40, 120, { size: 10 });
    const doc = await load(pdf.toBytes());
    const items = (await (await doc.getPage(1)).getTextContent()).items as any[];
    const widths = items.filter(i => i.str === 'AAAA').map(i => i.width);
    expect(widths[0]).toBeCloseTo(13.34, 1);
    expect(widths[1]).toBeCloseTo(26.68, 1);
  });

  it('flows many lines across pages with the cursor API (the fix for ignoring the returned y)', () => {
    const pdf = new PdfCreator();
    const lines = Array.from({ length: 5 }, (_, i) => 'linea ' + i).join('\n');
    pdf.setCursor(800);
    pdf.addParagraph(lines);
    expect(pdf.getPageCount()).toBe(2);
  });

  it('keeps working when the caller uses the returned y, over many pages (no overlaps)', async () => {
    const pdf = new PdfCreator();
    let y = 60;
    for (let i = 0; i < 200; i++) y = pdf.addText(`linea ${i}`, 40, y).y + 15;
    expect(pdf.getPageCount()).toBe(4);
    const doc = await load(pdf.toBytes());
    let total = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const items = ((await (await doc.getPage(p)).getTextContent()).items as any[]).filter(i => i.str);
      total += items.length;
      // En cada página las líneas bajan siempre (Y PDF decreciente): sin superposiciones
      items.slice(1).forEach((it, k) => expect(items[k].transform[5] - it.transform[5]).toBeCloseTo(15, 3));
    }
    expect(total).toBe(200);
  });

  it('primitives draw at the exact coordinates they are given', () => {
    const pdf = new PdfCreator();
    expect(pdf.addText('fila', 40, 830).pageBreak).toBe(true);
    pdf.addLine(40, 825, 555, 825); // regla de pie manual: se queda donde se pidió
    expect(asText(pdf.toBytes())).toContain(`40 ${Math.round((841.89 - 825) * 1000) / 1000} m`);
    expect(pdf.addText('normal', 40, 300).y).toBe(300);
  });

  it('keeps the caller x (indentation) on automatic breaks', () => {
    const pdf = new PdfCreator();
    const broken = pdf.addText('b', 60, 829);
    expect(broken.pageBreak).toBe(true);
    expect(broken.x - pdf.getTextWidth('b')).toBeCloseTo(60, 5);
  });

  it('breaking after setPage() inserts the new page right after the current one', async () => {
    const pdf = new PdfCreator();
    pdf.addText('P1', 40, 100);
    pdf.addPage();
    pdf.addText('P2', 40, 100);
    pdf.setPage(0);
    pdf.setCursor(780);
    pdf.addParagraph('sigue 1\nsigue 2\nsigue 3\nsigue 4\nsigue 5');
    expect(pdf.getPageCount()).toBe(3);
    const doc = await load(pdf.toBytes());
    const text = async (n: number) => ((await (await doc.getPage(n)).getTextContent()).items as any[]).map(i => i.str).join(' ');
    expect(await text(2)).toContain('sigue');
    expect(await text(3)).toContain('P2');
  });

  it('keeps leading indentation and repeated spaces (code, Courier columns)', () => {
    const pdf = new PdfCreator();
    expect(pdf.wrapText('  - item\nA    B', 500, { font: 'courier' })).toEqual(['  - item', 'A    B']);
    // Los espacios en el punto de corte automático se descartan
    const wrapped = pdf.wrapText('aaaa bbbb', pdf.getTextWidth('aaaa '));
    expect(wrapped).toEqual(['aaaa', 'bbbb']);
  });

  it('validates page size names', () => {
    expect(new PdfCreator({ pageSize: 'letter' as any }).getPageSize()).toEqual({ width: 612, height: 792 });
    expect(() => new PdfCreator({ pageSize: 'B5' as any })).toThrow(RangeError);
  });

  it('header callbacks get their own cursor at the top of the page', async () => {
    const pdf = new PdfCreator({ headerHeight: 40, onHeader: d => { d.addParagraph('Cabecera', { size: 9 }); } });
    pdf.setCursor(500);
    const doc = await load(pdf.toBytes());
    const item = ((await (await doc.getPage(1)).getTextContent()).items as any[])[0];
    expect(841.89 - item.transform[5]).toBeLessThan(20); // arriba del todo, no a media página
    expect(pdf.cursorY).toBe(500);
  });

  it('does not translate elements that start inside the printable area of the new page', async () => {
    const pdf = new PdfCreator();
    const r = pdf.addText('x', 40, 850); // salto automático
    // Imagen alta en coordenadas de la página nueva: se queda en la página 2 (no sale fuera)
    const y = await pdf.addImage(RED_JPEG, 40, r.y + 14, { width: 200, height: 770 });
    expect(y).toBeGreaterThan(0);
    // Texto válido cerca del final de la página 2: salto normal a la 3, no vuelve arriba
    const t = pdf.addText('fin', 40, 820);
    expect(t.pageBreak).toBe(true);
    expect(pdf.getCurrentPageIndex()).toBeGreaterThanOrEqual(2);
  });

  it('a paragraph placed higher (second column) does not move the cursor back', () => {
    const pdf = new PdfCreator();
    pdf.addParagraph('izquierda '.repeat(200), { maxWidth: 200 });
    const after = pdf.cursorY;
    pdf.addParagraph('derecha', { x: 300, y: 100, maxWidth: 200 });
    expect(pdf.cursorY).toBe(after);
  });

  it('splitting an emoji-only word does not add a blank line', () => {
    const pdf = new PdfCreator();
    expect(pdf.wrapText('😀', 1)).toEqual(['😀']);
  });

  it('rejects margins/header/footer that leave no printable area', () => {
    expect(() => new PdfCreator({ pageSize: 'A5', headerHeight: 200, footerHeight: 200, margins: { top: 200 } })).toThrow(RangeError);
    // Área pequeña pero válida: se permite
    expect(() => new PdfCreator({ pageSize: 'A5', headerHeight: 200, footerHeight: 200, margins: { top: 100 } })).not.toThrow();
    expect(() => new PdfCreator({ margins: { left: 300, right: 300 } })).toThrow(RangeError);
  });

  it('concurrent images: a failure does not remove a page another image is using', async () => {
    const pdf = new PdfCreator();
    const bad = pdf.addImage('data:image/png;base64,iVBORw0KGgo=', 40, 800, { width: 50, height: 100 });
    const good = pdf.addImage(RED_JPEG, 40, 900, { width: 50, height: 100 });
    await expect(bad).rejects.toThrow();
    await expect(good).resolves.toBeTypeOf('number');
    expect(() => pdf.toBytes()).not.toThrow();
  });

  it('rejects invalid custom page sizes and normalises orientation', () => {
    expect(() => new PdfCreator({ pageSize: { width: Number('abc'), height: 842 } })).toThrow(RangeError);
    expect(() => new PdfCreator({ pageSize: { width: 0, height: 500 } })).toThrow(RangeError);
    expect(new PdfCreator({ pageSize: { width: 800, height: 600 } }).getPageSize()).toEqual({ width: 800, height: 600 });
    expect(new PdfCreator({ pageSize: { width: 800, height: 600 }, orientation: 'portrait' }).getPageSize()).toEqual({ width: 600, height: 800 });
    expect(new PdfCreator({ pageSize: { width: 600, height: 800 }, orientation: 'landscape' }).getPageSize()).toEqual({ width: 800, height: 600 });
  });

  it('a trailing newline does not add an empty page', () => {
    const pdf = new PdfCreator();
    pdf.setCursor(pdf.getContentArea().bottom - 14);
    pdf.addParagraph('última línea\n');
    expect(pdf.getPageCount()).toBe(1);
  });

  it('absolutely positioned text does not move the flowing cursor', () => {
    const pdf = new PdfCreator();
    pdf.addText('CONFIDENCIAL', 40, 800);
    expect(pdf.cursorY).toBe(40);
    pdf.addParagraph('cuerpo');
    expect(pdf.getPageCount()).toBe(1);
  });

  it('justify stretches the gaps between words, not the indentation', async () => {
    const pdf = new PdfCreator();
    const text = '    Sangría inicial de un párrafo bastante largo que ocupa más de una línea completa sin duda alguna.';
    pdf.addParagraph(text, { align: 'justify', maxWidth: 250 });
    const doc = await load(pdf.toBytes());
    const first = ((await (await doc.getPage(1)).getTextContent()).items as any[]).find(i => i.str.trim());
    expect(first.transform[4]).toBeCloseTo(40 + pdf.getTextWidth('    '), 3);
    expect(first.transform[4] + first.width).toBeCloseTo(40 + 250, 0);
  });

  it('an image goes to the page where addImage was called, even if the page changes meanwhile', async () => {
    const pdf = new PdfCreator();
    pdf.addPage();
    pdf.setPage(0);
    const pending = pdf.addImage(RED_JPEG, 40, 100, { width: 50, height: 50 });
    pdf.setPage(1);
    await pending;
    expect(pdf.getCurrentPageIndex()).toBe(1);
    const doc = await load(pdf.toBytes());
    const ops1 = await (await doc.getPage(1)).getOperatorList();
    const ops2 = await (await doc.getPage(2)).getOperatorList();
    const paintsImage = (ops: any) => ops.fnArray.some((fn: number) => fn === 85 || fn === 86);
    expect(paintsImage(ops1)).toBe(true);
    expect(paintsImage(ops2)).toBe(false);
  });

  it('fit never shrinks an image that starts past the right margin to a sliver', async () => {
    const pdf = new PdfCreator();
    await pdf.addImage(RED_JPEG, 560, 100, { width: 30, height: 20, fit: true });
    expect(asText(pdf.toBytes())).toContain('q 30 0 0 20 560');
  });

  it('a failed image rejects, paints nothing and keeps its reserved space', async () => {
    const pdf = new PdfCreator();
    pdf.addParagraph('a');
    const cursor = pdf.cursorY;
    // PNG en Node (sin DOM): toJpeg falla
    await expect(pdf.addImage('data:image/png;base64,iVBORw0KGgo=', 40, 'cursor', { width: 50, height: 100 })).rejects.toThrow();
    expect(pdf.cursorY).toBeCloseTo(cursor + 100, 5);
    expect(asText(pdf.toBytes())).not.toContain(' Do Q');
  });

  it('concurrent addImage calls keep their call order across page breaks', async () => {
    const pdf = new PdfCreator();
    const a = pdf.addImage(RED_JPEG, 40, 700, { width: 100, height: 200 });
    const b = pdf.addImage(RED_JPEG, 40, 'cursor', { width: 100, height: 700 });
    await Promise.all([a, b]);
    expect(pdf.getPageCount()).toBe(3);
    const doc = await load(pdf.toBytes());
    const imgCount = async (n: number) => (await (await doc.getPage(n)).getOperatorList()).fnArray.filter((fn: number) => fn === 85).length;
    expect([await imgCount(1), await imgCount(2), await imgCount(3)]).toEqual([0, 1, 1]);
  });

  it('loadImage + drawImage draw synchronously', async () => {
    const pdf = new PdfCreator();
    const img = await pdf.loadImage(RED_JPEG);
    expect(img).toMatchObject({ pixelWidth: 3, pixelHeight: 2 });
    pdf.drawImage(img, 40, 40, { width: 30, height: 20 });
    pdf.drawImage(img, 100, 40, { width: 30, height: 20 });
    expect(asText(pdf.toBytes()).match(/\/Im1 Do Q/g)).toHaveLength(2);
  });

  it('after an automatic break the cursor is below the element that caused it', () => {
    const pdf = new PdfCreator();
    const r = pdf.addText('x', 40, 830, { size: 12 });
    expect(r.pageBreak).toBe(true);
    expect(pdf.cursorY).toBeCloseTo(r.y + 3, 5);
    pdf.addParagraph('sigue');
    expect(pdf.getPageCount()).toBe(2);
  });

  it('addParagraph honours a per-call autoPageBreak: false', () => {
    const pdf = new PdfCreator();
    pdf.setCursor(800);
    pdf.addParagraph('uno\ndos\ntres', { autoPageBreak: false });
    expect(pdf.getPageCount()).toBe(1);
  });

  it('header/footer callbacks cannot change pages, and their images do not stick to the page', async () => {
    let drawLogo = true;
    const pdf = new PdfCreator({
      headerHeight: 40,
      onHeader: d => {
        if (drawLogo) d.drawImage(logo, 40, 5, { width: 20, height: 20 });
      },
    });
    const logo = await pdf.loadImage(RED_JPEG);
    expect(asText(pdf.toBytes())).toContain('/XObject');
    drawLogo = false;
    expect(asText(pdf.toBytes())).not.toContain('/XObject <<');
    const bad = new PdfCreator({ onFooter: d => d.setPage(0) });
    expect(() => bad.toBytes()).toThrow(/onHeader\/onFooter/);
  });

  it('per-call autoPageBreak: false draws exactly where asked', () => {
    const pdf = new PdfCreator();
    expect(pdf.addText('pie', 40, 835, { autoPageBreak: false })).toMatchObject({ y: 835, pageBreak: false });
    expect(pdf.getPageCount()).toBe(1);
  });

  it('justifies each line with a single text object using word spacing', async () => {
    const pdf = new PdfCreator();
    const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    pdf.addParagraph(text, { align: 'justify', maxWidth: 300 });
    const raw = asText(pdf.toBytes());
    const lines = pdf.wrapText(text, 300);
    expect(raw.match(/BT /g)).toHaveLength(lines.length);
    const doc = await load(pdf.toBytes());
    const items = ((await (await doc.getPage(1)).getTextContent()).items as any[]).filter(i => i.str.trim());
    // Todas las líneas menos la última ocupan exactamente el ancho máximo
    expect(items[0].width).toBeCloseTo(300, 0);
    expect(items[items.length - 1].width).toBeLessThan(300);
  });

  it('justify does not stretch the last line of each line of source text', async () => {
    const pdf = new PdfCreator();
    pdf.addParagraph('Hi there\nnext line here', { align: 'justify' });
    const doc = await load(pdf.toBytes());
    const items = ((await (await doc.getPage(1)).getTextContent()).items as any[]).filter(i => i.str.trim());
    expect(items.map(i => i.str)).toEqual(['Hi there', 'next line here']);
  });

  it('header/footer callbacks never move the document cursor', () => {
    const pdf = new PdfCreator({ headerHeight: 30, onHeader: d => { d.addParagraph('Header', { y: 10 }); } });
    pdf.addParagraph('a');
    const before = pdf.cursorY;
    pdf.toBytes();
    expect(pdf.cursorY).toBe(before);
  });

  it('keeps one cursor per page across setPage', () => {
    const pdf = new PdfCreator();
    pdf.addParagraph('uno\ndos\ntres');
    const page1Cursor = pdf.cursorY;
    pdf.addPage();
    pdf.addParagraph('otra');
    pdf.setPage(0);
    expect(pdf.cursorY).toBe(page1Cursor);
  });

  it('does not modify the config object passed by the user', () => {
    const config = { margins: { left: 50 } };
    const pdf = new PdfCreator(config);
    pdf.addParagraph('texto '.repeat(500), { align: 'justify' });
    expect(config).toEqual({ margins: { left: 50 } });
  });

  it('does not resize images that already fit (e.g. a logo near the right edge)', async () => {
    const pdf = new PdfCreator();
    await pdf.addImage(RED_JPEG, 520, 20, { width: 60, height: 30 });
    expect(asText(pdf.toBytes())).toContain('q 60 0 0 30 520');
  });

  it('default header honours the left margin', async () => {
    const pdf = new PdfCreator({ margins: { left: 72 }, headerHeight: 30, defaultHeader: { text: 'Izq', align: 'left' } });
    const doc = await load(pdf.toBytes());
    const item = (await (await doc.getPage(1)).getTextContent()).items[0] as any;
    expect(item.transform[4]).toBeCloseTo(72, 3);
  });

  it('wraps paragraphs within the margins, breaking pages and long words', async () => {
    const pdf = new PdfCreator({ margins: { left: 50, right: 50 } });
    const text = 'Lorem ipsum dolor sit amet consectetur. '.repeat(300) + 'Supercalifragilisticoespialidoso'.repeat(8);
    const result = pdf.addParagraph(text, { size: 11, align: 'justify' });
    expect(result.pagesAdded).toBeGreaterThan(0);
    expect(pdf.getPageCount()).toBe(1 + result.pagesAdded);
    expect(result.y).toBe(pdf.cursorY);
    const doc = await load(pdf.toBytes());
    for (let p = 1; p <= doc.numPages; p++) {
      const items = (await (await doc.getPage(p)).getTextContent()).items as any[];
      for (const it of items.filter(i => i.str)) {
        expect(it.transform[4]).toBeGreaterThanOrEqual(50 - 0.01);
        expect(it.transform[4] + it.width).toBeLessThanOrEqual(595.28 - 50 + 0.5);
        expect(it.transform[5]).toBeGreaterThan(20 - 0.01); // por encima del margen inferior
      }
    }
  });

  it('wrapText respects newlines and breaks long words', () => {
    const pdf = new PdfCreator();
    expect(pdf.wrapText('uno dos\n\ntres', 1000)).toEqual(['uno dos', '', 'tres']);
    const parts = pdf.wrapText('x'.repeat(50), 30, { size: 10 });
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach(p => expect(pdf.getTextWidth(p, { size: 10 })).toBeLessThanOrEqual(30));
  });

  it('flows paragraphs and images with the cursor', async () => {
    const pdf = new PdfCreator({ margins: { top: 60 } });
    expect(pdf.cursorY).toBe(60);
    pdf.addParagraph('Título', { size: 20, spacingAfter: 10 });
    const afterTitle = pdf.cursorY;
    expect(afterTitle).toBeCloseTo(60 + 24 + 10, 5);
    await pdf.addImage(RED_JPEG, 40, 'cursor', { width: 100, height: 50 });
    expect(pdf.cursorY).toBeCloseTo(afterTitle + 50, 5);
    pdf.moveDown(2000);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.cursorY).toBe(60);
  });

  it('scales images down to fit the printable area', async () => {
    const pdf = new PdfCreator({ headerHeight: 50, footerHeight: 50 });
    await pdf.addImage(RED_JPEG, 40, 100, { width: 300, height: 1500, fit: true });
    const area = pdf.getContentArea();
    const h = area.bottom - area.top;
    const text = asText(pdf.toBytes());
    const m = /q ([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.-]+ cm \/Im1 Do Q/.exec(text)!;
    expect(Number(m[2])).toBeCloseTo(h, 2);
    expect(Number(m[1])).toBeCloseTo(300 * (h / 1500), 2);
    expect(pdf.getPageCount()).toBe(2);
  });

  it('supports page sizes, orientation and margins', async () => {
    const pdf = new PdfCreator({ pageSize: 'Letter', orientation: 'landscape', margins: { left: 72, right: 72 } });
    expect(pdf.getPageSize()).toEqual({ width: 792, height: 612 });
    pdf.addText('Centro', 0, 100, { align: 'center' });
    const doc = await load(pdf.toBytes());
    const page = await doc.getPage(1);
    expect(page.view).toEqual([0, 0, 792, 612]);
    const item = (await page.getTextContent()).items[0] as any;
    expect(item.transform[4] + item.width / 2).toBeCloseTo(792 / 2, 1);
  });

  it('setPage validates the index', () => {
    const pdf = new PdfCreator();
    expect(() => pdf.setPage(3)).toThrow(RangeError);
  });
});
