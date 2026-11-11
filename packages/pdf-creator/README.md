# @jmt-code/pdf-creator

A lightweight, dependency-free TypeScript library for generating PDF files in the browser.

[![npm version](https://img.shields.io/npm/v/@jmt-code/pdf-creator.svg)](https://www.npmjs.com/package/@jmt-code/pdf-creator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **No external dependencies**: writes the PDF 1.7 format directly, with exact byte offsets.
- **Text**: the 14 standard PDF fonts (Helvetica, Times, Courier, each in normal, bold, italic and bold italic) with WinAnsi encoding. Accents, `ñ`, `€`, `“ ”` and `—` render correctly. Characters outside WinAnsi become `?`.
- **Exact measurement**: `getTextWidth()` uses the official Adobe font metrics, so it needs no canvas and gives the same result in Node.
- **Text decorations**: underline, strikethrough, horizontal scaling and clickable links.
- **Images**: JPEG files are embedded as they are, without re-encoding. PNG, GIF and WebP are converted with a canvas, which needs a browser. An image used several times is stored only once.
- **Shapes**: lines and rectangles (fill and/or stroke).
- **Headers and footers**: default ones with `{pageNumber}` and `{totalPages}` placeholders, or custom callbacks.
- **Repeatable output**: `toBytes()`, `getOutput()` and `save()` can be called as often as you like and never change the document.
- **ESM and CommonJS** builds, with TypeScript types.

## Installation

```bash
npm install @jmt-code/pdf-creator
```

## Usage

Coordinates are in points (A4 = 595.28 × 841.89) with the origin at the **top-left** corner. For text, `y` is the **baseline**.

```typescript
import { PdfCreator } from '@jmt-code/pdf-creator';

const pdf = new PdfCreator({
  headerHeight: 40,
  footerHeight: 40,
  defaultHeader: { text: 'Informe anual', align: 'center', color: '#888888' },
  defaultFooter: { text: 'Página {pageNumber} de {totalPages}', align: 'right' },
});

pdf.addText('Hola, España — 25 €', 40, 100, { size: 24, style: 'bold' });
pdf.addText('Visit the project', 40, 130, { color: '#0078d4', underline: true, link: 'https://github.com/Jmt-code/pdfEditor' });
pdf.addRect(40, 150, 200, 2, { fill: '#cccccc' });

// addImage is async: await it before saving
await pdf.addImage(jpegDataUrl, 40, 170, { width: 200, height: 120 });

pdf.addPage();
pdf.addText('Page 2', 40, 100);

pdf.save('document.pdf');       // download (browser)
const blob = pdf.getOutput();   // Blob
const bytes = pdf.toBytes();    // Uint8Array (also works in Node)
```

### Custom header and footer

The callbacks run on every page while the PDF is built. They must draw synchronously (`addImage` can't be used inside them).

```typescript
const pdf = new PdfCreator({
  headerHeight: 40,
  onHeader: (doc, pageNumber, totalPages) => {
    doc.addText(`Custom header — ${pageNumber}/${totalPages}`, 40, 25, { size: 9 });
    doc.addLine(40, 32, 555, 32, { color: '#dddddd' });
  },
});
```

## API Reference

### `new PdfCreator(config?: PdfConfig)`

| Option | Description |
|---|---|
| `headerHeight`, `footerHeight` | Space reserved at the top/bottom of each page, in points (max 200). |
| `defaultHeader` | `{ text, align, color }` |
| `defaultFooter` | `{ text, showPageNumbers, align, color }`. `text` supports `{pageNumber}` and `{totalPages}`. Without placeholders, `showPageNumbers` (default `true`) appends `Page N`. |
| `onHeader`, `onFooter` | `(doc, pageNumber, totalPages) => void`. Replace the default header/footer. |
| `autoPageBreak` | Start a new page automatically when text or an image goes past the bottom margin. Default `true`. |

### Drawing

| Method | Description |
|---|---|
| `addText(text, x, y, options?)` | Returns `{ x, y, pageBreak }`, where `x` is the end of the text. Options: `size`, `font` (`'helvetica' \| 'times' \| 'courier'`), `style` (`'normal' \| 'bold' \| 'italic' \| 'bolditalic'`), `color`, `align` (`'left' \| 'center' \| 'right'`, aligned between the `marginX` margins), `marginX`, `underline`, `strikethrough`, `horizontalScale` (%), `link`. |
| `addImage(src, x, y, { width, height })` | Async. `src`: a data URL, or an `http(s)`/`blob` URL. Returns the `y` actually used. |
| `addLine(x1, y1, x2, y2, { color, width })` | Straight line. |
| `addRect(x, y, width, height, { fill, stroke, lineWidth })` | Rectangle, positioned by its top-left corner. |
| `addLink(x, y, width, height, url)` | Clickable area. |
| `getTextWidth(text, options?)` | Width of the text in points. |

### Pages

| Method | Description |
|---|---|
| `addPage()` | Adds a page and makes it the current page. |
| `setPage(index)` | Makes page `index` (0-based) the current page. Throws `RangeError` if the index is out of range. |
| `getPageCount()`, `getCurrentPageIndex()` | Page count and current page index. |
| `getPageSize()`, `getContentArea()` | Page size, and the top/bottom of the printable area (header and footer excluded). |

### Output

| Method | Description |
|---|---|
| `toBytes(): Uint8Array` | The serialized PDF. |
| `getOutput(): Blob` | The PDF as a `Blob` (`application/pdf`). |
| `save(filename)` | Downloads the PDF (adds `.pdf` if missing). |

### Helpers

- `encodeWinAnsi(text)`: converts a string to the WinAnsi bytes used by the PDF.
- `readJpegInfo(bytes)`: returns the width, height and number of color components of a JPEG.

## Links

- [GitHub Repository](https://github.com/Jmt-code/pdfEditor)
- [Report Issues](https://github.com/Jmt-code/pdfEditor/issues)

## License

MIT. Created by [Jmt-code](https://github.com/Jmt-code)
