# PDF Editor Monorepo

Browser-only tools for creating PDF files: a zero-dependency PDF generator, and a Word-like document editor that exports to PDF. The editor can be used as a React component or as an SDK from any framework or a `<script>` tag. No server needed.

## Packages

| Package | Description |
|---|---|
| **[@jmt-code/pdf-creator](./packages/pdf-creator)** [![npm](https://img.shields.io/npm/v/@jmt-code/pdf-creator.svg)](https://www.npmjs.com/package/@jmt-code/pdf-creator) | Zero-dependency PDF 1.7 generator. Page sizes and margins, paragraphs that wrap and break pages on their own, standard fonts with accents, `ñ` and `€`, exact metrics, images, lines, rectangles, links, headers and footers. |
| **[@jmt-code/pdf-editor](./packages/pdf-editor)** | Word-like web editor with A4 pages, header/footer, tables, page breaks, clean paste from Word/Docs, i18n (en/es) and themes. Exports to PDF (matching the editor layout), HTML and print. Available as a React 18/19 component, as an SDK (`createEditor`) and as a `<script>` bundle. |
| [example-app](./packages/example-app) | Demos published on GitHub Pages: React (`/`) and the SDK in plain JS (`/sdk.html`). |

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

```js
// Any framework / plain JS
import { createEditor } from '@jmt-code/pdf-editor/sdk';
const editor = createEditor(document.getElementById('editor'), { locale: 'es' });
editor.on('change', ({ document }) => save(document));
```

## Development

```bash
npm install
npm run dev        # demos at http://localhost:5173/pdfEditor/ (React) and /pdfEditor/sdk.html (SDK)
npm run test       # unit tests (vitest; generated PDFs are checked with pdf.js)
npm run typecheck
npm run build      # pdf-creator → pdf-editor → example-app
npm run ci         # typecheck + test + build, as run on GitHub Actions
```

## License

[MIT](./LICENSE). Created by [Jmt-code](https://github.com/Jmt-code)
