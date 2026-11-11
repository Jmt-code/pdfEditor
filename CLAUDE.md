# pdf-editor-monorepo

npm workspaces monorepo with a browser-only PDF generator and a Word-like React editor that exports to PDF. No backend: everything runs in the browser.

## Packages

| Package | Description |
|---|---|
| `@jmt-code/pdf-creator` | Zero-dependency PDF 1.7 generator. Standard 14 fonts with WinAnsi encoding and exact AFM metrics, JPEG images, lines/rects, link annotations. Works in Node for everything except non-JPEG images. |
| `@jmt-code/pdf-editor` | React (18 or 19) contentEditable editor with A4 pages, header/footer, Markdown shortcuts, PDF export via pdf-creator. Depends on DOMPurify. |
| `example-app` | Vite + React demo app (deployed to GitHub Pages). |

## Commands (repo root)

```bash
npm run dev        # example-app dev server (http://localhost:5173)
npm run typecheck  # all packages (builds pdf-creator first: the editor type-checks against its dist)
npm run test       # vitest: pdf-creator (node + pdfjs-dist) and pdf-editor (jsdom)
npm run build      # pdf-creator (tsup, ESM+CJS) → pdf-editor (vite lib, ESM+CJS) → example-app
npm run ci         # typecheck + test + build (what GitHub Actions runs)
npm run deploy     # deploy example-app to GitHub Pages
```

Build order matters: `pdf-creator` must be built before `pdf-editor` and `example-app`, which resolve it through `dist/`.

## Architecture

- **pdf-creator** (`packages/pdf-creator/src/PdfCreator.ts`): top-left origin in points, text Y = baseline. `toBytes()` / `getOutput()` / `save()` are pure: they can be called repeatedly; header/footer are drawn into per-build overlays. Object ids and byte offsets are computed per build. `fontMetrics.ts` is generated from the Adobe AFM files (do not edit by hand).
- **HTML → PDF** (`packages/pdf-editor/src/utils/`):
  - `htmlLayout.ts`: lets the browser lay out the HTML with the editor CSS and measures every word (`Range.getClientRects`), image, background, border, list marker, underline and link. `paginate()` splits pages between lines (never through one).
  - `pdfGenerator.ts`: mounts the sanitized HTML off-screen, measures, paginates and draws on PdfCreator (words are horizontally scaled with `Tz` to match the measured width).
  - `usePageCalculation` uses the same `collectLayout` + `paginate`, so the editor's page count matches the PDF.
- **Security**: all HTML entering the DOM goes through `sanitizeHtml` (DOMPurify); URLs go through `isSafeUrl` (blocks `javascript:`, non-image `data:`...). Markdown shortcuts build DOM nodes, never `insertHTML` with user text.
- `document.execCommand` is deprecated but still used for formatting commands.

## Conventions

- Code comments follow the language of each file (editor files are in Spanish).
- Do not bump versions or publish to npm without being asked.
