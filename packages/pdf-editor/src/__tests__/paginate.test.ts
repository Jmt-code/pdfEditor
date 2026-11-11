import { describe, expect, it } from 'vitest';
import { paginate, pageIndexFor } from '../utils/htmlLayout';
import type { TextRun } from '../utils/htmlLayout';

const line = (y: number, height = 20): TextRun => ({
  kind: 'text', text: 'x', x: 0, y, width: 10, height, baseline: y + 15,
  font: 'helvetica', style: 'normal', sizePx: 16, color: '#000000',
});

describe('paginate', () => {
  it('keeps everything on one page when it fits', () => {
    expect(paginate({ atoms: [line(0), line(30), line(60)] }, 100)).toEqual([0]);
  });

  it('never splits a line: the next page starts at the line that does not fit', () => {
    // Línea en 90..110 con página de 100 px → la página 2 empieza en 90
    expect(paginate({ atoms: [line(0), line(30), line(60), line(90)] }, 100)).toEqual([0, 90]);
  });

  it('groups words of the same line even with different heights', () => {
    const atoms = [line(80, 18), { ...line(78, 24) }];
    expect(paginate({ atoms }, 100)).toEqual([0, 78]);
  });

  it('cuts text boxes taller than a page at the page limit', () => {
    expect(paginate({ atoms: [line(0, 250)] }, 100)).toEqual([0, 100, 200]);
  });

  it('treats images taller than a page as one page (they are scaled down)', () => {
    const img = { kind: 'image' as const, src: 'a.png', x: 0, y: 0, width: 10, height: 250 };
    expect(paginate({ atoms: [img, line(260)] }, 100)).toEqual([0, 260]);
  });

  it('moves a background block to the next page together with its first line', () => {
    const atoms = [line(0), line(60), line(105)];
    // Bloque con fondo que empieza en 85 (padding) y cuya primera línea (105) no cabe
    const fills = [{ x: 0, y: 85, width: 100, height: 60, color: '#000000' }];
    expect(paginate({ atoms, fills }, 100)).toEqual([0, 85]);
  });

  it('pageIndexFor maps y to the page', () => {
    const breaks = [0, 90, 180];
    expect(pageIndexFor(breaks, 10)).toBe(0);
    expect(pageIndexFor(breaks, 90)).toBe(1);
    expect(pageIndexFor(breaks, 500)).toBe(2);
  });
});

describe('paginate: manual page breaks', () => {
  const line = (y: number): TextRun => ({
    kind: 'text', text: 'x', x: 0, y, width: 10, height: 20, baseline: y + 15,
    font: 'helvetica', style: 'normal', sizePx: 16, color: '#000000',
  });
  it('a forced break opens a page at the next line', () => {
    expect(paginate({ atoms: [line(0), line(40)], forcedBreaks: [30] }, 1000)).toEqual([0, 40]);
  });
  it('a forced break after all the content still adds a page', () => {
    expect(paginate({ atoms: [line(0)], forcedBreaks: [30] }, 1000)).toEqual([0, 30]);
  });
  it('a forced break at the top of a page does not add an empty page', () => {
    expect(paginate({ atoms: [line(0)], forcedBreaks: [0] }, 1000)).toEqual([0]);
  });
});

describe('paginate: borders and backgrounds without text', () => {
  const fill = (y: number, height = 1) => ({ x: 0, y, width: 100, height, color: '#000000' });
  const text = (y: number): TextRun => ({
    kind: 'text', text: 'x', x: 0, y, width: 10, height: 20, baseline: y + 15,
    font: 'helvetica', style: 'normal', sizePx: 16, color: '#000000',
  });
  // Tabla vacía: cada fila (30 px, desde `top`) tiene borde superior y laterales; la última, borde inferior
  const emptyTable = (top: number, rows: number) => [
    ...Array.from({ length: rows }, (_, i) => [fill(top + i * 30), fill(top + i * 30, 30)]).flat(),
    fill(top + rows * 30),
  ];

  it('an empty table taller than a page gets its own pages, breaking between rows', () => {
    expect(paginate({ atoms: [], fills: emptyTable(0, 10) }, 100)).toEqual([0, 90, 180, 270]);
  });
  it('content after a tall empty table is not skipped', () => {
    expect(paginate({ atoms: [text(0), text(320)], fills: emptyTable(25, 10) }, 100)).toEqual([0, 85, 175, 265]);
  });
  it('a border that only sticks out a few px does not open an almost empty page', () => {
    expect(paginate({ atoms: [text(75)], fills: [fill(104)] }, 100)).toEqual([0]);
  });
});
