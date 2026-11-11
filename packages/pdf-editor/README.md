# @jmt-code/pdf-editor

A powerful, customizable React PDF editor component with a Word-like interface, Markdown support, and PDF export capabilities.

## Features

- 📝 **Rich Text Editing** - Word-like toolbar with formatting options
- ⌨️ **Markdown Shortcuts** - Use `# `, `**bold**`, `*italic*`, etc.
- 📄 **Page Visualization** - Real-time page break indicators
- 🎨 **Customizable** - Theming via CSS variables
- ♿ **Accessible** - ARIA labels and keyboard navigation
- 📱 **Responsive** - Works on desktop and mobile
- 🔧 **TypeScript** - Full type definitions included
- 🎯 **Ref API** - Programmatic control via React refs

## Installation

```bash
npm install @jmt-code/pdf-editor @jmt-code/pdf-creator
```

## Quick Start

```tsx
import { PdfEditor } from '@jmt-code/pdf-editor';
import '@jmt-code/pdf-editor/style.css';

function App() {
  return <PdfEditor />;
}
```

## Configuration

```tsx
import { PdfEditor, PdfEditorRef } from '@jmt-code/pdf-editor';
import '@jmt-code/pdf-editor/style.css';
import { useRef } from 'react';

function App() {
  const editorRef = useRef<PdfEditorRef>(null);

  const handleExport = (blob: Blob) => {
    // Custom export handling
    console.log('PDF generated:', blob);
  };

  return (
    <PdfEditor
      ref={editorRef}
      config={{
        initialContent: '<h1>My Document</h1><p>Start writing...</p>',
        defaultHeaderText: 'My Company',
        defaultFooterText: 'Page {pageNumber}',
        exportFileName: 'my-document',
        placeholder: 'Type something...',
        readOnly: false,
      }}
      onChange={(content) => console.log('Content changed:', content)}
      onExport={handleExport}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `config` | `PdfEditorConfig` | Editor configuration options |
| `onChange` | `(content: string) => void` | Called when content changes |
| `onExport` | `(blob: Blob) => void` | Custom export handler |
| `onError` | `(error: Error) => void` | Error handler |
| `className` | `string` | Additional CSS classes |
| `style` | `React.CSSProperties` | Inline styles |

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialContent` | `string` | Welcome message | Initial HTML content. It is sanitized before it is rendered. |
| `defaultHeaderText` | `string` | `'HEADER'` | Default header text |
| `defaultFooterText` | `string` | `'Page {pageNumber}'` | Default footer. Supports `{pageNumber}` and `{totalPages}`. |
| `exportFileName` | `string` | `'document'` | PDF filename |
| `placeholder` | `string` | `'Start typing...'` | Empty editor placeholder |
| `readOnly` | `boolean` | `false` | Turns off editing, the toolbar, keyboard and Markdown shortcuts, and drag & drop. |
| `showHeaderFooterPanel` | `boolean` | `false` | Show header/footer panel |
| `documentWidth`, `documentMinHeight` | `number` | — | **Deprecated and ignored.** The document is always A4. |

## Ref API

Access editor methods programmatically:

```tsx
const editorRef = useRef<PdfEditorRef>(null);

// Get current HTML content
const content = editorRef.current?.getContent();

// Set content
editorRef.current?.setContent('<p>New content</p>');

// Export to PDF (returns Blob)
const blob = await editorRef.current?.exportPdf();

// Download PDF
await editorRef.current?.downloadPdf('my-file.pdf');

// Focus the editor
editorRef.current?.focus();

// Execute formatting command
editorRef.current?.execCommand('bold');
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+S` | Export PDF |

## Markdown Shortcuts

Type these at the beginning of a line:

| Shortcut | Result |
|----------|--------|
| `# ` | Heading 1 |
| `## ` | Heading 2 |
| `### ` | Heading 3 |
| `- ` or `* ` | Bullet list |
| `1. ` | Numbered list |
| `> ` | Blockquote |
| ```` ``` ```` | Code block |
| `---` | Horizontal rule |

Inline formatting is applied when you type a space after the closing marker:

| Shortcut | Result |
|----------|--------|
| `**text** ` | **Bold** |
| `*text* ` | *Italic* |
| `~~text~~ ` | ~~Strikethrough~~ |
| `` `text` `` + space | `Inline code` |

The typed text is always inserted as text, never as HTML.

## PDF Export

The PDF uses the same layout as the editor. The browser lays out the content with the editor's styles, and the exporter measures where every word, image, background, border, bullet or number, underline and link ends up, then draws it at that spot in the PDF. As a result:

- Pages break between lines, never through one. The page count in the status bar matches the PDF.
- Supported: headings, paragraphs, bold, italic, underline, strikethrough, colors, numbered and bullet lists, blockquotes, inline code and code blocks (spaces and line breaks kept), images, clickable links, and horizontal rules.
- Text uses the standard PDF fonts (Helvetica, Times or Courier, picked from the CSS font family). Each word is stretched to the width it has on screen. Characters outside WinAnsi (CJK, emoji) become `?`.
- Images from other domains need CORS. If an image can't be loaded, it is skipped and a warning is logged to the console, and the export still finishes.

## Security

- All HTML that enters the editor (`initialContent`, `setContent`, the content measured for export) goes through `sanitizeHtml` (DOMPurify). It removes scripts, event handlers, iframes, forms and dangerous styles.
- Links and images go through `isSafeUrl`. Links accept `http(s)`, `mailto:`, `tel:` and relative URLs. Images accept `http(s)`, relative URLs and `data:image/(png|jpeg|gif|webp)`. `javascript:`, `vbscript:` and other `data:` URLs are blocked.
- Image files inserted from disk must be PNG, JPEG, GIF or WebP, up to 5 MB.

Both functions are exported in case you need them in your app.

## Theming

Customize via CSS variables:

```css
.pdf-editor {
  --pdf-editor-bg: #f3f3f3;
  --pdf-editor-text: #333;
  --pdf-editor-toolbar-bg: linear-gradient(180deg, #fff 0%, #f8f8f8 100%);
  --pdf-editor-border: #d4d4d4;
  --pdf-editor-primary: #0078d4;
  --pdf-editor-primary-hover: #106ebe;
  --pdf-editor-workspace-bg: #525659;
  --pdf-editor-page-bg: #ffffff;
  --pdf-editor-header-footer-bg: #fafafa;
  --pdf-editor-active-bg: #cce4ff;
  --pdf-editor-active-color: #0066cc;
}
```

## Advanced Usage

### Using Individual Components

```tsx
import {
  Toolbar,
  HeaderFooterPanel,
  useEditorCommands,
  useMarkdownShortcuts,
} from '@jmt-code/pdf-editor';

// Build your own custom editor
function CustomEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [formats, setFormats] = useState(new Set());

  const { execCommand, formatBlock } = useEditorCommands(
    editorRef,
    setFormats,
    () => {}
  );

  return (
    <div>
      <Toolbar
        activeFormats={formats}
        onCommand={execCommand}
        // ...other props
      />
      <div
        ref={editorRef}
        contentEditable
        // ...
      />
    </div>
  );
}
```

### Generating PDF Without UI

```tsx
import { generatePdfFromContent, downloadPdf } from '@jmt-code/pdf-editor';

async function generatePdf() {
  const html = '<h1>My Document</h1><p>Content...</p>';
  const blob = await generatePdfFromContent(html, 'Header', 'Footer', 'doc');
  downloadPdf(blob, 'my-document.pdf');
}
```

## Requirements

- React 18 or 19 (`react` and `react-dom`)
- A browser environment (PDF export measures the layout with the DOM)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

MIT

---

Created by [Jmt-code](https://github.com/Jmt-code)
