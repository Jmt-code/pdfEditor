import { useRef } from 'react'
import { PdfEditor, PdfEditorRef, downloadPdf } from '@jmt-code/pdf-editor'
import '@jmt-code/pdf-editor/style.css'

function App() {
  const editorRef = useRef<PdfEditorRef>(null)

  const handleChange = (content: string) => {
    console.log('Content updated:', content.substring(0, 100) + '...')
  }

  const handleExport = (blob: Blob, fileName: string) => {
    console.log('PDF exported:', blob.size, 'bytes, filename:', fileName)
    // Descargar el PDF con el nombre configurado
    downloadPdf(blob, fileName)
  }

  const handleError = (error: Error) => {
    console.error('Editor error:', error)
  }

  return (
    <PdfEditor
      ref={editorRef}
      config={{
        initialContent: `
          <h1>Welcome to PDF Editor</h1>
          <p>This is a powerful document editor with PDF export capabilities.</p>
          <h2>Features</h2>
          <ul>
            <li><strong>Rich text editing</strong> - Format text like in Word</li>
            <li><em>Markdown shortcuts</em> - Use # for headings, **text** for bold</li>
            <li>Headers and footers with page numbers</li>
            <li>Export to PDF with one click</li>
          </ul>
          <h3>Try it out!</h3>
          <p>Start typing to see the editor in action. Use the toolbar above or keyboard shortcuts:</p>
          <ul>
            <li><code>Ctrl+B</code> - Bold</li>
            <li><code>Ctrl+I</code> - Italic</li>
            <li><code>Ctrl+U</code> - Underline</li>
            <li><code>Ctrl+S</code> - Export to PDF</li>
          </ul>
        `,
        defaultHeaderText: 'PDF Editor Demo',
        defaultFooterText: 'Page {pageNumber}',
        exportFileName: 'my-document',
      }}
      onChange={handleChange}
      onExport={handleExport}
      onError={handleError}
    />
  )
}

export default App
