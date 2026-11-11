import { describe, expect, it } from 'vitest';
import { isSafeUrl, sanitizeHtml } from '../utils/sanitize';

describe('sanitizeHtml', () => {
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
