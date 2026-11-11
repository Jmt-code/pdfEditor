// Genera el PDF de docs/images/pdf-creator-sample.png: node examples/informe.mjs
import fs from 'node:fs';
import { PdfCreator } from '@jmt-code/pdf-creator';
const pdf = new PdfCreator({
  pageSize: 'A4',
  margins: { top: 60, right: 50, bottom: 50, left: 50 },
  headerHeight: 30,
  footerHeight: 30,
  defaultHeader: { text: 'Informe anual', color: '#888888' },
  defaultFooter: { text: 'Página {pageNumber} de {totalPages}', align: 'right' },
});
pdf.addParagraph('Informe anual 2026', { size: 22, style: 'bold', spacingAfter: 12 });
const text = 'Este documento se ha generado con @jmt-code/pdf-creator, sin dependencias y sin servidor. Los párrafos se ajustan al ancho de la página con las métricas reales de la fuente, se pueden justificar y saltan de página solos. Acentos, eñes, el símbolo del euro (25 €) y las comillas “tipográficas” se muestran correctamente.';
pdf.addParagraph(text, { size: 11, align: 'justify', lineHeight: 1.4, spacingAfter: 10 });
pdf.addParagraph('Resumen', { size: 15, style: 'bold', spacingAfter: 6 });
pdf.addParagraph('• Ventas: +12 % respecto al año anterior.\n• Nuevos clientes: 340.\n• Satisfacción media: 4,6 / 5.', { size: 11, lineHeight: 1.5, spacingAfter: 10 });
const y = pdf.cursorY;
pdf.addRect(50, y, 495, 40, { fill: '#eef5fc', stroke: '#0078d4', lineWidth: 0.8 });
pdf.addText('Texto alineado a la derecha, con color y subrayado', 0, y + 25, { size: 11, align: 'right', color: '#0078d4', underline: true, marginX: 60 });
pdf.setCursor(y + 52);
pdf.addParagraph('Visita el proyecto en GitHub', { color: '#0078d4', underline: true, link: 'https://github.com/Jmt-code/pdfEditor' });
fs.writeFileSync('informe.pdf', pdf.toBytes());
