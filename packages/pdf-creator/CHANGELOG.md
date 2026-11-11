# Changelog

## 0.2.0

### Added
- Page sizes (`'A4'`, `'A5'`, `'Letter'`, `'Legal'` or `{ width, height }`), `orientation` and `margins`.
- Flowing content: `addParagraph()` wraps text with the real font metrics, supports `left`, `center`, `right` and `justify`, and breaks pages on its own. `wrapText()` splits text into lines without drawing it.
- Per-page cursor: `cursorY`, `setCursor()`, `moveDown()`.
- `loadImage()` + `drawImage()` to load an image once and draw it many times (also inside header/footer callbacks). `addImage()` reserves its place synchronously, so concurrent calls keep their order.
- `setPage()` is now public. New `insertPage()`, `getPageCount()`, `getCurrentPageIndex()`, `getPageSize()`, `getMargins()` and `getContentArea()`.
- `setAutoPageBreak()` / `isAutoPageBreak()`, plus `autoPageBreak` per call.
- Text options: `underline`, `strikethrough`, `horizontalScale`, `link`. New `addLine()`, `addRect()` and `addLink()`.
- `toBytes()` returns the PDF as a `Uint8Array` (also works in Node).
- `{totalPages}` placeholder, and `totalPages` as the third argument of `onHeader` / `onFooter`.
- Helpers: `encodeWinAnsi`, `readJpegInfo`, `PAGE_SIZES`.
- Dual ESM / CommonJS build with types.

### Changed
- Text uses WinAnsi encoding with the official Adobe metrics: accents, `ñ`, `€`, typographic quotes and dashes now render correctly. `getTextWidth()` no longer needs a canvas.
- JPEG images are embedded as they are, without re-encoding; an image used several times is stored once.
- `toBytes()`, `getOutput()` and `save()` can be called repeatedly and never change the document. Headers and footers are drawn when the PDF is built.
- Automatic page breaks insert the new page right after the current one, and `addText` keeps its `x` after a break.
- Default margins are `40 / 40 / 20 / 40` points. Content that previously ran into the bottom edge now moves to a new page.
- An unknown page size, an invalid size or margins that leave no printable area throw a `RangeError`.
- Header/footer callbacks cannot call `addPage()` or `setPage()` (they throw). If a callback throws, the current page and cursor are restored.

## 0.1.0

- First release.
