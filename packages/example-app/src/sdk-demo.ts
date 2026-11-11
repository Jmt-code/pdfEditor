// Demo del SDK sin React en el código de la aplicación: solo createEditor + eventos
import { createEditor } from '@jmt-code/pdf-editor/sdk'
import '@jmt-code/pdf-editor/style.css'

const log = document.getElementById('log')!
const editor = createEditor(document.getElementById('editor')!, {
  locale: 'es',
  content: {
    version: 1,
    html: `<h1>Informe trimestral</h1>
<p>Este editor se ha montado con <strong>createEditor()</strong> desde JavaScript puro.</p>
<table><thead><tr><th>Región</th><th>Ventas</th><th>Variación</th></tr></thead>
<tbody><tr><td>Norte</td><td>12.500 €</td><td>+4 %</td></tr><tr><td>Sur</td><td>9.800 €</td><td>−2 %</td></tr></tbody></table>
<p style="line-height: 2">Párrafo con interlineado doble para comprobar que el estilo llega al PDF.</p>
<div data-page-break="true"></div>
<h2>Segunda página</h2>
<p>Este contenido empieza en una página nueva gracias al salto manual.</p>`,
    header: 'ACME S.L. — Confidencial',
    footer: 'Página {pageNumber} de {totalPages}',
    fileName: 'informe',
  },
  toolbarItems: [
    { id: 'stamp', label: '✍', title: 'Insertar firma', run: (ed) => ed.execute('insertHTML', '<p><em>Firmado: Dirección</em></p>') },
  ],
})

let readOnly = false
let locale: 'es' | 'en' = 'es'
let dark = false

editor.ready.then(() => {
  log.textContent = 'listo'
  ;(window as unknown as { editor: typeof editor }).editor = editor // para depurar desde la consola
})
editor.on('stats', (s) => {
  log.textContent = `${s.words} palabras · ${s.pages} páginas`
})
editor.on('change', ({ document: doc }) => {
  console.debug('[sdk-demo] change', doc.html.length, 'chars')
})
editor.on('export', ({ format, fileName }) => console.debug('[sdk-demo] export', format, fileName))

const on = (id: string, fn: () => void) => document.getElementById(id)!.addEventListener('click', fn)
on('btn-bold', () => editor.execute('bold'))
on('btn-table', () => editor.insertTable(3, 3))
on('btn-break', () => editor.insertPageBreak())
on('btn-readonly', () => editor.setReadOnly((readOnly = !readOnly)))
on('btn-locale', () => editor.configure({ locale: (locale = locale === 'es' ? 'en' : 'es') }))
on('btn-theme', () => editor.configure({ theme: (dark = !dark) ? { primary: '#7c3aed', workspaceBackground: '#1e1b4b' } : undefined }))
on('btn-html', () => {
  const blob = new Blob([editor.exportHtml()], { type: 'text/html' })
  window.open(URL.createObjectURL(blob), '_blank', 'noopener')
})
on('btn-print', () => void editor.print())
