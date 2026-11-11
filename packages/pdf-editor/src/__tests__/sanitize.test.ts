import { describe, expect, it } from 'vitest';
import { isSafeUrl, sanitizeHtml } from '../utils/sanitize';

describe('sanitizeHtml', () => {
  it('conserva tablas y extensiones válidas', () => {
    const clean = sanitizeHtml('<table style="border-collapse:collapse;width:100%"><caption>Datos</caption><colgroup><col style="width:20px"></colgroup><thead><tr><th colspan="2">Título</th></tr></thead><tbody><tr><td rowspan="50" style="vertical-align:top;border:1px solid black">Valor</td></tr></tbody><tfoot><tr><td>Fin</td></tr></tfoot></table>');
    expect(clean).toContain('colspan="2"');
    expect(clean).toContain('rowspan="50"');
    expect(clean).toMatch(/border-collapse:\s*collapse/);
    expect(clean).toMatch(/width:\s*100%/);
    expect(clean).toContain('<caption>Datos</caption>');
  });
  it('valida los bordes expandidos (como los enumeran los navegadores reales)', () => {
    const clean = sanitizeHtml('<table><tr><td style="border-top-width: 2px; border-top-style: solid; border-top-color: red; border-left-style: url(x)">x</td></tr></table>');
    expect(clean).toMatch(/border-top-width:\s*2px/);
    expect(clean).toMatch(/border-top-style:\s*solid/);
    expect(clean).toMatch(/border-top-color:\s*red/);
    expect(clean).not.toContain('url(');
  });
  it('conserva tamaños de fuente por palabra clave', () => {
    expect(sanitizeHtml('<span style="font-size: x-large">x</span>')).toMatch(/font-size:\s*x-large/);
  });
  it.each(['0', '-1', '51', '1.5', '2px', 'abc'])('rechaza extensiones de celda inválidas: %s', (value) => {
    expect(sanitizeHtml(`<table><tr><td colspan="${value}" rowspan="${value}">x</td></tr></table>`)).not.toMatch(/colspan|rowspan/);
  });
  it('normaliza saltos de página solo en div y hr', () => {
    expect(sanitizeHtml('<div data-page-break=""></div><hr data-page-break="true"><p data-page-break="true" data-other="true">x</p><div data-page-break="false"></div>')).toBe('<div data-page-break="true"></div><hr data-page-break="true"><p>x</p><div></div>');
  });
  it('conserva longitudes permitidas y limita width a las tablas', () => {
    const clean = sanitizeHtml('<p style="line-height:1.5;margin-left:2cm;padding-left:3pt;text-indent:-1em;width:20px">x</p>');
    expect(clean).toContain('line-height: 1.5');
    expect(clean).toContain('margin-left: 2cm');
    expect(clean).toContain('padding-left: 3pt');
    expect(clean).toContain('text-indent: -1em');
    expect(clean).not.toContain('width');
    expect(sanitizeHtml('<p style="line-height:normal;margin-left:auto;font-size:2vw">x</p>')).toBe('<p>x</p>');
  });
  it.each(['url(x)', 'expression(x)', 'var(--x)', 'a@b', 'a\\62', 'a/*x*/b', 'a&lt;b', 'a&gt;b', 'javascript:x'])('elimina valores CSS peligrosos: %s', (value) => {
    expect(sanitizeHtml(`<span style="font-family:${value}">x</span>`)).toBe('<span>x</span>');
  });
  it.each([
    '<img src="https://example.com/a.png" onerror="alert(1)">',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    '<iframe src="https://example.com"></iframe><object></object><form><input></form><style>body{color:red}</style>',
  ])('elimina contenido peligroso: %s', (html) => {
    expect(sanitizeHtml(html)).not.toMatch(/onerror|<script|javascript:|java\tscript:|data:text|<iframe|<object|<form|<style/i);
  });
  it('conserva texto enriquecido y URLs seguras', () => {
    const html = '<h1>Título</h1><p><strong>Hola</strong> <em>mundo</em><span style="color: red; text-align: center">color</span><a href="/ruta#x">enlace</a><img src="data:image/png;base64,YQ==" alt="foto"></p>';
    const clean = sanitizeHtml(html);
    expect(clean).toContain('<strong>Hola</strong>');
    expect(clean).toContain('color: red');
    expect(clean).toContain('href="/ruta#x"');
    expect(clean).toContain('data:image/png;base64,YQ==');
  });
  it.each(['javascript:x', 'JaVaScRiPt:x', 'java\tscript:x', ' data:text/html,x', 'vbscript:x', 'data:text/html,x'])('rechaza URL %s', (url) => {
    expect(isSafeUrl(url, 'link')).toBe(false);
    expect(isSafeUrl(url, 'image')).toBe(false);
  });
  it.each(['https://example.com', 'http://example.com', 'mailto:a@b.com', 'tel:123', '/ruta', '../ruta', '#seccion'])('acepta enlace %s', (url) => {
    expect(isSafeUrl(url, 'link')).toBe(true);
  });
  it('elimina CSS ajeno a color y alineación', () => {
    expect(sanitizeHtml('<span style="position:fixed;background-image:url(https://example.com)">x</span>')).toBe('<span>x</span>');
  });
});

describe('sanitizeHtml conserva formatos de texto', () => {
  it('mantiene tamaño, familia, peso, estilo y decoración', () => {
    const out = sanitizeHtml('<span style="font-size:32px;font-family:Courier New;font-weight:bold;font-style:italic;text-decoration:underline">Texto</span>');
    for (const prop of ['font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration']) expect(out).toContain(prop);
  });
  it('sigue eliminando valores peligrosos en esas propiedades', () => {
    expect(sanitizeHtml('<span style="font-family:url(javascript:alert(1))">x</span>')).not.toContain('url(');
  });
});
