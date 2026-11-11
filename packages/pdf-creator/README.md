# @jmt-code/pdf-creator

A lightweight, dependency-free TypeScript library for generating PDF files in the browser (and in Node for everything except non-JPEG images).

[![npm version](https://img.shields.io/npm/v/@jmt-code/pdf-creator.svg)](https://www.npmjs.com/package/@jmt-code/pdf-creator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Live demo** of the editor built on top of it: [jmt-code.github.io/pdfEditor](https://jmt-code.github.io/pdfEditor/)

## Features

- **No external dependencies**: writes the PDF 1.7 format directly, with exact byte offsets.
- **Pages**: A4, A5, Letter, Legal or a custom size, in portrait or landscape, with configurable margins.
- **Text that flows**: `addParagraph()` wraps text using the real font metrics, aligns it left, center, right or justified, and breaks pages on its own. A cursor keeps track of where the next element goes, so you never have to compute `y` by hand.
- **Fonts**: the 14 standard PDF fonts (Helvetica, Times, Courier, each in normal, bold, italic and bold italic) with WinAnsi encoding. Accents, `ñ`, `€`, `“ ”` and `—` render correctly; characters outside WinAnsi become `?`. Widths are exact (official Adobe metrics), so measuring needs no canvas.
- **Decorations**: underline, strikethrough, horizontal scaling and clickable links.
- **Images**: JPEG is embedded as is, without re-encoding. PNG, GIF and WebP are converted with a canvas, which needs a browser. An image used several times is stored only once. You can load an image once and draw it as many times as you like (`loadImage` + `drawImage`), or load and draw in one call (`addImage`). Optionally, images are scaled down to fit the page.
- **Shapes**: lines and rectangles (fill and/or stroke).
- **Headers and footers**: default ones with `{pageNumber}` and `{totalPages}` placeholders, or custom callbacks.
- **Repeatable output**: `toBytes()`, `getOutput()` and `save()` can be called as often as you like and never change the document.
- **ESM and CommonJS** builds, with TypeScript types.

## Installation

```bash
npm install @jmt-code/pdf-creator
```

## Usage

Coordinates are in points (A4 = 595.28 × 841.89) with the origin at the **top-left** corner. For `addText`, `y` is the **baseline**; for paragraphs, images and shapes it is the **top** edge.

### Flowing content (recommended)

```typescript
import { PdfCreator } from '@jmt-code/pdf-creator';

const pdf = new PdfCreator({
  pageSize: 'A4',
  margins: { top: 60, right: 50, bottom: 50, left: 50 },
  headerHeight: 30,
  footerHeight: 30,
  defaultHeader: { text: 'Informe anual', color: '#888888' },
  defaultFooter: { text: 'Página {pageNumber} de {totalPages}', align: 'right' },
});

pdf.addParagraph('Informe anual 2026', { size: 22, style: 'bold', spacingAfter: 12 });
pdf.addParagraph(longText, { size: 11, align: 'justify', lineHeight: 1.4, spacingAfter: 8 });
await pdf.addImage(chartJpeg, 50, 'cursor', { width: 300, height: 180, fit: true });
pdf.moveDown(12);
pdf.addParagraph('Visit the project', { color: '#0078d4', underline: true, link: 'https://github.com/Jmt-code/pdfEditor' });

pdf.save('informe.pdf');       // download (browser)
const blob = pdf.getOutput();  // Blob
const bytes = pdf.toBytes();   // Uint8Array (also in Node)
```

### Absolute positioning

```typescript
pdf.addText('Hola, España — 25 €', 40, 100, { size: 24, style: 'bold' });
pdf.addRect(40, 110, 200, 2, { fill: '#cccccc' });
pdf.addLine(40, 120, 240, 120, { color: '#999999', width: 0.5 });

// When text runs off the bottom it moves to a new page: continue from the returned y
let y = 700;
for (const line of lines) y = pdf.addText(line, 40, y).y + 14;
```

### Custom header and footer

The callbacks run on every page while the PDF is built. They must draw synchronously: to place an image, load it beforehand with `loadImage` and draw it with `drawImage`. They get a temporary cursor of their own (starting at the top of the page) and cannot call `addPage` or `setPage`.

```typescript
import { PdfCreator, type PdfImage } from '@jmt-code/pdf-creator';

let logo: PdfImage | undefined;
const pdf = new PdfCreator({
  headerHeight: 40,
  onHeader: (doc, pageNumber, totalPages) => {
    if (logo) doc.drawImage(logo, 40, 8, { width: 24, height: 24 });
    doc.addText(`${pageNumber}/${totalPages}`, 0, 25, { size: 9, align: 'right' });
  },
});
logo = await pdf.loadImage(logoJpeg); // before calling save()/getOutput()
```

## API Reference

### `new PdfCreator(config?: PdfConfig)`

| Option | Description |
|---|---|
| `pageSize` | `'A4'` (default), `'A5'`, `'Letter'`, `'Legal'` or `{ width, height }` in points. An unknown name or an invalid size throws a `RangeError`. |
| `orientation` | `'portrait'` or `'landscape'`. A custom size without `orientation` is used exactly as given. |
| `margins` | `{ top, right, bottom, left }` in points. Default `40 / 40 / 20 / 40`. If the margins plus the header and footer leave no printable area, the constructor throws a `RangeError`. |
| `headerHeight`, `footerHeight` | Space reserved at the top/bottom of each page (max 200). |
| `defaultHeader` | `{ text, align, color }`. The text is aligned between the page margins, as in Word. |
| `defaultFooter` | `{ text, showPageNumbers, align, color }`. `text` supports `{pageNumber}` and `{totalPages}`. Without placeholders, `showPageNumbers` (default `true`) appends `Page N`. |
| `onHeader`, `onFooter` | `(doc, pageNumber, totalPages) => void`. Replace the default header/footer. |
| `autoPageBreak` | Start a new page automatically when content would go past the bottom margin. Default `true`. Each call can override it with `{ autoPageBreak: false }`. |

### Flowing content and cursor

| Method | Description |
|---|---|
| `addParagraph(text, options?)` | Wraps the text to `maxWidth` (by default from `x` to the right margin), with alignment `left`, `center`, `right` or `justify`, a `lineHeight` (default 1.2), and the same `size`, `font`, `style`, `color`, `underline`, `strikethrough` and `link` options as `addText`. It starts at the cursor (or at `y`), breaks pages as needed and leaves the cursor below the text. `\n` starts a new line; indentation and repeated spaces are kept. Returns `{ y, lines, pagesAdded }`. |
| `wrapText(text, maxWidth, options?)` | Splits the text into lines, without drawing. |
| `cursorY`, `setCursor(y)`, `moveDown(points)` | Position of the next flowing element, on the current page. Each page keeps its own cursor. |

### Drawing

| Method | Description |
|---|---|
| `addText(text, x, y, options?)` | Draws one line of text with its baseline at `y`. If it crosses the bottom margin it moves to the top of a new page, keeping `x`. Returns `{ x, y, pageBreak }`, where `x` is the end of the text: continue from the returned `y`. It does not move the cursor, except after a page break. Options: `size`, `font`, `style`, `color`, `align` (between the margins), `marginX`, `underline`, `strikethrough`, `horizontalScale` (%), `link`, `autoPageBreak`. |
| `loadImage(src)` | Async. Loads an image once (a data URL or an `http(s)`/`blob` URL) and returns a handle. |
| `drawImage(image, x, y, { width, height, fit?, autoPageBreak? })` | Synchronous. Draws an image loaded with `loadImage`. Pass `'cursor'` as `y` to place it at the cursor and move the cursor below it. |
| `addImage(src, x, y, options)` | Loads and draws in one call. The page and position are decided when you call it, so concurrent calls keep their order. If loading fails, the promise rejects and the reserved space stays. |
| `addLine(x1, y1, x2, y2, { color, width })` | Straight line, drawn at exactly these coordinates (never breaks pages). |
| `addRect(x, y, width, height, { fill, stroke, lineWidth })` | Rectangle with its top-left corner at `(x, y)`, drawn exactly where given. |
| `addLink(x, y, width, height, url)` | Clickable area. |
| `getTextWidth(text, options?)` | Width of the text in points. |

### Pages

| Method | Description |
|---|---|
| `addPage()` | Adds a page at the end and makes it current. Automatic breaks instead insert the new page right after the current one. |
| `setPage(index)` | Makes page `index` (0-based) the current one, with its own cursor. Throws `RangeError` if the index is out of range. |
| `getPageCount()`, `getCurrentPageIndex()` | Page count and current page index. |
| `getPageSize()`, `getMargins()`, `getContentArea()` | Page size, margins, and the printable area (`top`, `bottom`, `left`, `right`). |
| `setAutoPageBreak(enabled)`, `isAutoPageBreak()` | Turns automatic page breaks on or off for the whole document. |

### Output

| Method | Description |
|---|---|
| `toBytes(): Uint8Array` | The serialized PDF. |
| `getOutput(): Blob` | The PDF as a `Blob` (`application/pdf`). |
| `save(filename)` | Downloads the PDF (adds `.pdf` if missing). |

### Helpers

- `encodeWinAnsi(text)`: converts a string to the WinAnsi bytes used by the PDF.
- `readJpegInfo(bytes)`: returns the width, height and number of color components of a JPEG.
- `PAGE_SIZES`: the named page sizes, in points.

## Links

- [GitHub Repository](https://github.com/Jmt-code/pdfEditor)
- [Report Issues](https://github.com/Jmt-code/pdfEditor/issues)

## License

MIT. Created by [Jmt-code](https://github.com/Jmt-code)
