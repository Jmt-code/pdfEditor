import{r as s,j as t,f as l,N as c,c as p,R as u}from"./style-CVhwMsXK.js";const d={initialContent:`
    <h1>Document Title - PDF Editor Demo</h1>
    <p>This is a powerful document editor with PDF export capabilities. It displays your content as separate pages, just like Microsoft Word, with visual page breaks showing exactly where each page ends and the next one begins.</p>

    <h2>Features Overview</h2>
    <p>The editor provides a complete word processing experience with the following capabilities:</p>
    <ul>
      <li><strong>Rich text editing</strong> - Format text with bold, italic, underline, and more</li>
      <li><em>Markdown shortcuts</em> - Use # for headings, **text** for bold, *text* for italic</li>
      <li>Headers and footers with automatic page numbers</li>
      <li>Visual page breaks showing document pagination</li>
      <li>Export to PDF with one click</li>
    </ul>

    <h2>Keyboard Shortcuts</h2>
    <p>Use these keyboard shortcuts to speed up your workflow:</p>
    <ul>
      <li><code>Ctrl+B</code> - Bold text</li>
      <li><code>Ctrl+I</code> - Italic text</li>
      <li><code>Ctrl+U</code> - Underline text</li>
      <li><code>Ctrl+S</code> - Export to PDF</li>
    </ul>

    <h2>Page Layout</h2>
    <p>The editor simulates an A4 page layout (210mm × 297mm) with standard margins. As you type more content, new pages are automatically created and visual page breaks appear between them.</p>
    <p>The gray area between pages represents the physical separation between printed pages. Headers appear at the top of each page and footers at the bottom, with automatic page numbering.</p>

    <h3>Working with Long Documents</h3>
    <p>When working with longer documents, the editor provides smooth scrolling through all pages. You can see exactly how your content will be distributed across pages in the final PDF output.</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
    <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>

    <h2>Text Formatting Examples</h2>
    <p>You can format your text in many ways:</p>
    <blockquote>This is a blockquote. Use the &gt; character at the beginning of a line to create one. Blockquotes are great for highlighting important information or quoting external sources.</blockquote>
    <p>Here is a paragraph with <strong>bold text</strong>, <em>italic text</em>, and <code>inline code</code>. You can also combine formats like <strong><em>bold italic</em></strong>.</p>

    <h3>Lists, links and accents</h3>
    <ol>
      <li>Numbered lists keep their numbers in the PDF</li>
      <li>Links stay clickable: <a href="https://github.com/Jmt-code/pdfEditor">project on GitHub</a></li>
      <li><u>Underlined</u> and <s>struck-through</s> text</li>
    </ol>
    <p>Acentos y eñes: «Año nuevo, canción española, pingüino» — 25 €.</p>

    <h3>Code Blocks</h3>
    <p>You can insert code blocks using triple backticks:</p>
    <pre>function greet(name: string): string {
  return \`Hello, \${name}! Welcome to PDF Editor.\`;
}

const message = greet("World");
console.log(message);</pre>

    <h2>Conclusion</h2>
    <p>This document demonstrates the Word-like editing experience with visual page breaks. Scroll down to see how the content flows across multiple pages, with headers and footers repeated on each page.</p>
    <p>Try adding more content to see additional pages appear automatically. The page counter in the status bar at the bottom shows the total number of pages in your document.</p>
    <p>Thank you for using PDF Editor! We hope this tool helps you create beautiful documents with ease.</p>
  `,defaultHeaderText:"PDF Editor Demo",defaultFooterText:"Page {pageNumber}",exportFileName:"my-document"};function h(){const o=s.useRef(null),i=e=>{},a=(e,n)=>{c(e,n)},r=e=>{console.error("Editor error:",e)};return t.jsx(l,{ref:o,config:d,onChange:i,onExport:a,onError:r})}p.createRoot(document.getElementById("root")).render(t.jsx(u.StrictMode,{children:t.jsx(h,{})}));
