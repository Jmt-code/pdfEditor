# PDF Editor Monorepo

Browser-only tools for creating PDF files: a zero-dependency PDF generator, and a Word-like React editor that exports to PDF. No server needed.

## Packages

| Package | Description |
|---|---|
| **[@jmt-code/pdf-creator](./packages/pdf-creator)** [![npm](https://img.shields.io/npm/v/@jmt-code/pdf-creator.svg)](https://www.npmjs.com/package/@jmt-code/pdf-creator) | Zero-dependency PDF 1.7 generator. Standard fonts with accents, `ñ` and `€`, exact text metrics, JPEG/PNG images, lines, rectangles, links, headers and footers. |
| **[@jmt-code/pdf-editor](./packages/pdf-editor)** | React 18/19 editor with A4 pages, header/footer, Markdown shortcuts and PDF export that matches the editor layout. |
| [example-app](./packages/example-app) | Demo app (Vite + React), published on GitHub Pages. |

## Quick example

```typescript
import { PdfCreator } from '@jmt-code/pdf-creator';

const pdf = new PdfCreator({ defaultFooter: { text: 'Página {pageNumber} de {totalPages}' } });
pdf.addText('Hola, España — 25 €', 40, 80, { size: 20, style: 'bold' });
pdf.save('documento.pdf');
```

```tsx
import { PdfEditor } from '@jmt-code/pdf-editor';
import '@jmt-code/pdf-editor/style.css';

<PdfEditor config={{ defaultHeaderText: 'My report' }} onChange={html => save(html)} />;
```

## Development

```bash
npm install
npm run dev        # demo app at http://localhost:5173/pdfEditor/
npm run test       # unit tests (vitest; generated PDFs are checked with pdf.js)
npm run typecheck
npm run build      # pdf-creator → pdf-editor → example-app
npm run ci         # typecheck + test + build, as run on GitHub Actions
```

## License

[MIT](./LICENSE). Created by [Jmt-code](https://github.com/Jmt-code)
