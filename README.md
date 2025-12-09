# PDF Editor Monorepo

A lightweight, dependency-free TypeScript library for generating PDF files in the browser.

## Packages

- **[@jmt-code/pdf-creator](./packages/pdf-creator)**: Core library for generating PDFs [![npm](https://img.shields.io/npm/v/@jmt-code/pdf-creator.svg)](https://www.npmjs.com/package/@jmt-code/pdf-creator)
- **[@jmt-code/pdf-editor](./packages/pdf-editor)**: React components for building PDF editors ⚠️ *WIP*

## Features

- **No External Dependencies**: Generates PDFs using raw PDF 1.7 specification.
- **Text Support**: Add text with customizable fonts, sizes, colors, and alignment.
- **Image Support**: Embed JPEG and PNG images.
- **Pagination**: Create multi-page documents.
- **Headers & Footers**: Powerful configuration for custom or default headers and footers.

## Installation

```bash
npm install @jmt-code/pdf-creator
```

## Usage

### Basic Example

```typescript
import { PdfCreator } from '@jmt-code/pdf-creator';

const pdf = new PdfCreator();

// Add Text
pdf.addText('Hello World', 20, 20, { size: 24, color: '#FF0000' });

// Add Image
pdf.addImage(base64ImageData, 20, 50, { width: 100, height: 100 });

// Add New Page
pdf.addPage();
pdf.addText('Page 2', 20, 20);

// Save
pdf.save('document.pdf');
```

### Configuration (Headers & Footers)

You can configure default headers and footers or provide custom render functions.

#### Default Header/Footer

```typescript
const pdf = new PdfCreator({
  defaultHeader: {
    text: 'My Company Confidential',
    align: 'center',
    color: '#888888'
  },
  defaultFooter: {
    text: 'Report 2023',
    showPageNumbers: true,
    align: 'right'
  }
});
```

#### Custom Header/Footer

```typescript
const pdf = new PdfCreator({
  onHeader: (doc, pageNum) => {
    doc.addText(`Custom Header - Page ${pageNum}`, 20, 20);
  },
  onFooter: (doc, pageNum) => {
    doc.addText(`Page ${pageNum}`, 500, 800);
  }
});
```

## API Reference

### `new PdfCreator(config?: PdfConfig)`

Creates a new PDF document.

**PdfConfig Interface:**
- `defaultHeader`: Configuration for default header.
- `defaultFooter`: Configuration for default footer.
- `onHeader`: Callback function to render custom header.
- `onFooter`: Callback function to render custom footer.

### `addText(text: string, x: number, y: number, options?: TextOptions)`

Adds text to the current page.

**TextOptions Interface:**
- `size`: Font size (default: 12).
- `font`: Font family (default: 'helvetica').
- `style`: 'normal', 'bold', 'italic', 'bolditalic'.
- `color`: Hex color code (e.g., '#FF0000').
- `align`: 'left', 'center', 'right'.

### `addImage(imageData: string, x: number, y: number, options: ImageOptions)`

Adds an image to the current page. `imageData` should be a base64 string.

### `addPage()`

Adds a new page to the document.

### `save(filename: string)`

Generates and downloads the PDF file.

### `getOutput(): Blob`

Returns the PDF as a Blob object.

---

Created by [Jmt-code](https://github.com/Jmt-code)

