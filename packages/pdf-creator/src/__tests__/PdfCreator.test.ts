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

  it('setPage validates the index', () => {
    const pdf = new PdfCreator();
    expect(() => pdf.setPage(3)).toThrow(RangeError);
  });
});
