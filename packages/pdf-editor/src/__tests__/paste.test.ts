import { act, createElement } from 'react';
import type { ClipboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePaste } from '../hooks/usePaste';
import { sanitizeHtml, sanitizePastedHtml } from '../utils/sanitize';

describe('sanitizePastedHtml', () => {
  it('limpia Word y reconstruye listas reconocibles', () => {
    const clean = sanitizePastedHtml('<!--[if gte mso 9]><xml>oculto</xml><![endif]--><p class="MsoNormal">Hola<o:p>&nbsp;</o:p></p><p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">• </span>Uno</p><p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span>• </span>Dos</p><p class="MsoListParagraph" style="mso-list:l1 level1 lfo2"><span>1. </span>Tres</p>');
    expect(clean).toContain('<p>Hola</p>');
    expect(clean).toContain('<ul><li>Uno</li><li>Dos</li></ul>');
    expect(clean).toContain('<ol><li>Tres</li></ol>');
    expect(clean).not.toMatch(/mso|class=|o:p|oculto|<!--/i);
    expect(sanitizeHtml(clean)).toBe(clean);
  });
  it('convierte el formato de Google Docs manteniendo el color', () => {
    const clean = sanitizePastedHtml('<b id="docs-internal-guid-123" style="font-weight:normal"><span style="font-weight:700;color:red">Negrita</span><span style="font-style:italic">Cursiva</span><span style="text-decoration:underline line-through">Ambos</span></b>');
    expect(clean).not.toMatch(/docs-internal|<b\b/);
    expect(clean).toContain('<strong>Negrita</strong>');
    expect(clean).toContain('<em>Cursiva</em>');
    expect(clean).toContain('<s><u>Ambos</u></s>');
    expect(clean).toMatch(/color:\s*red/);
    expect(clean).not.toMatch(/font-weight/);
  });
  it('elimina metadatos, fuentes vacías y párrafos vacíos repetidos', () => {
    expect(sanitizePastedHtml('<style>p{color:red}</style><meta charset="utf-8"><link href="x"><title>Título</title><xml>x</xml><w:test>x</w:test><m:test>x</m:test><v:test>x</v:test><!-- comentario --><font>Texto</font><p>&nbsp;</p>\n<p>&nbsp;</p><p>&nbsp;</p>')).toBe('Texto\n<p>&nbsp;</p>');
  });
  it('sanea ataques del portapapeles', () => {
    const clean = sanitizePastedHtml('<img src="/foto.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a><script>alert(1)</script>');
    expect(clean).toBe('<img src="/foto.png"><a>x</a>');
  });
});

describe('usePaste', () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    window.getSelection()?.removeAllRanges();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setup(disabled = false, commandResult = false) {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.textContent = 'Inicio';
    document.body.append(host, editor);
    const root = createRoot(host);
    const onPasted = vi.fn();
    let handlePaste!: (event: ClipboardEvent) => void;
    function Harness() {
      ({ handlePaste } = usePaste({ current: editor }, { disabled, onPasted }));
      return null;
    }
    act(() => root.render(createElement(Harness)));
    const execCommand = vi.fn().mockReturnValue(commandResult);
    const original = Object.getOwnPropertyDescriptor(document, 'execCommand');
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    cleanups.push(() => {
      act(() => root.unmount());
      host.remove();
      editor.remove();
      if (original) Object.defineProperty(document, 'execCommand', original);
      else Reflect.deleteProperty(document, 'execCommand');
    });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    function paste(html = '', text = '', files: File[] = []) {
      const preventDefault = vi.fn();
      act(() => handlePaste({ preventDefault, clipboardData: { getData: (type: string) => type === 'text/html' ? html : text, files } } as unknown as ClipboardEvent));
      return preventDefault;
    }
    return { editor, paste, onPasted, execCommand };
  }

  it('inserta HTML saneado con Range cuando execCommand devuelve false', () => {
    const { editor, paste, onPasted, execCommand } = setup();
    paste('<strong>Hola</strong><img onerror="alert(1)">', 'ignorado');
    // La imagen sin src válido (queda rota tras sanear) no se inserta
    expect(execCommand).toHaveBeenCalledWith('insertHTML', false, '<strong>Hola</strong>');
    expect(editor.innerHTML).toBe('Inicio<strong>Hola</strong>');
    expect(onPasted).toHaveBeenCalledOnce();
  });
  it('si el HTML queda vacío tras sanear, pega el texto plano', () => {
    const { editor, paste } = setup();
    paste('<svg><text>Etiqueta del gráfico</text></svg>', 'Etiqueta del gráfico');
    expect(editor.innerHTML).toBe('InicioEtiqueta del gráfico');
  });
  it('conserva la sangría del texto plano', () => {
    const { editor, paste } = setup();
    paste('', 'if (x) {\n    y();\n}');
    expect(editor.innerHTML).toBe('Inicioif (x) {<br>&nbsp;&nbsp;&nbsp;&nbsp;y();<br>}');
  });
  it('conserva saltos y escapa texto plano', () => {
    const { editor, paste } = setup();
    paste('', '<uno>&\nsegunda\n\ntercera');
    expect(editor.innerHTML).toBe('Inicio<p>&lt;uno&gt;&amp;<br>segunda</p><p>tercera</p>');
  });
  it('utiliza execCommand sin duplicar la inserción', () => {
    const { editor, paste, execCommand, onPasted } = setup(false, true);
    paste('<em>Hola</em>');
    expect(execCommand).toHaveBeenCalledWith('insertHTML', false, '<em>Hola</em>');
    expect(editor.innerHTML).toBe('Inicio');
    expect(onPasted).toHaveBeenCalledOnce();
  });
  it('bloquea el pegado deshabilitado', () => {
    const { editor, paste, execCommand, onPasted } = setup(true);
    expect(paste('<b>Hola</b>')).toHaveBeenCalledOnce();
    expect(editor.innerHTML).toBe('Inicio');
    expect(execCommand).not.toHaveBeenCalled();
    expect(onPasted).not.toHaveBeenCalled();
  });
  it('nunca inserta con una selección fuera del editor', () => {
    const { paste, execCommand, onPasted } = setup();
    const range = document.createRange();
    range.selectNodeContents(document.body);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    paste('<p>Hola</p>');
    expect(execCommand).not.toHaveBeenCalled();
    expect(onPasted).not.toHaveBeenCalled();
  });
  it('inserta imágenes válidas sin texto', async () => {
    const { editor, paste, onPasted } = setup();
    paste('', '', [new File(['imagen'], 'foto.png', { type: 'image/png' })]);
    await vi.waitFor(() => expect(onPasted).toHaveBeenCalledOnce());
    expect(editor.querySelector('img')?.src).toMatch(/^data:image\/png;base64,/);
  });
  it('descarta tipos de imagen y tamaños no permitidos', () => {
    const { paste, onPasted } = setup();
    paste('', '', [new File(['<svg/>'], 'foto.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' })]);
    expect(onPasted).not.toHaveBeenCalled();
  });
});
