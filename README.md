# PDF Generator Library

A lightweight, dependency-free TypeScript library for generating PDF files in the browser.

## Features

- **No External Dependencies**: Generates PDFs using raw PDF 1.7 specification.
- **Text Support**: Add text with customizable fonts, sizes, colors, and alignment.
- **Image Support**: Embed JPEG and PNG images.
- **Pagination**: Create multi-page documents.
- **Headers & Footers**: Powerful configuration for custom or default headers and footers.

## Installation

Since this is a monorepo, you can use the package locally. If you were to publish it:

```bash
npm install pdf-generator
```

## Usage

### Basic Example

```typescript
import { PdfGenerator } from 'pdf-generator';

const pdf = new PdfGenerator();

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
const pdf = new PdfGenerator({
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
const pdf = new PdfGenerator({
  onHeader: (doc, pageNum) => {
    doc.addText(`Custom Header - Page ${pageNum}`, 20, 20);
  },
  onFooter: (doc, pageNum) => {
    doc.addText(`Page ${pageNum}`, 500, 800);
  }
});
```

## API Reference

### `new PdfGenerator(config?: PdfConfig)`

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

