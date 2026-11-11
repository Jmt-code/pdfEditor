# Changelog

## 0.1.0

First public release.

- Word-like contentEditable editor with A4 pages, header and footer, tables, manual page breaks (Ctrl+Enter), Markdown shortcuts and clean paste from Word, Google Docs and LibreOffice.
- PDF export measured from the browser layout: the page count in the editor matches the PDF. HTML export and printing.
- i18n (English and Spanish, any text can be overridden), themes through CSS variables, configurable toolbar with custom buttons.
- React 18 / 19 component (`PdfEditor`) with a ref API.
- Framework-agnostic SDK (`@jmt-code/pdf-editor/sdk`, `createEditor`) with methods and events, and a `<script>` bundle (`dist/pdf-editor.sdk.js`, global `PdfEditorSDK`).
- Secure by default: all HTML goes through DOMPurify with a CSS whitelist; URLs and theme values are validated.
- ESM and CommonJS builds with types.
- Requires `@jmt-code/pdf-creator` 0.2.0 or later.
