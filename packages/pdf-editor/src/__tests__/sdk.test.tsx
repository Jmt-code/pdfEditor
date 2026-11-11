import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createEditor, isSafeThemeValue } from '../sdk';
import type { EditorInstance } from '../sdk';

// jsdom no implementa execCommand/queryCommandState
beforeAll(() => {
  (document as unknown as { execCommand: () => boolean }).execCommand = () => false;
  (document as unknown as { queryCommandState: () => boolean }).queryCommandState = () => false;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom no implementa la geometría de Range (los navegadores reales sí)
  const empty = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
  Range.prototype.getClientRects ??= empty as unknown as Range['getClientRects'];
  Range.prototype.getBoundingClientRect ??= (() => new DOMRect()) as Range['getBoundingClientRect'];
});

let editors: EditorInstance[] = [];
afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors = [];
  document.body.innerHTML = '';
});

async function mount(options: Parameters<typeof createEditor>[1] = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  let editor!: EditorInstance;
  await act(async () => {
    editor = createEditor(el, options);
  });
  await act(async () => {
    await editor.ready;
  });
  editors.push(editor);
  return { el, editor };
}

describe('createEditor (SDK)', () => {
  it('mounts, sanitizes the initial content and exposes the document', async () => {
    const { editor } = await mount({
      content: { version: 1, html: '<p>Hola <img src=x onerror="alert(1)"></p>', header: 'Cab', footer: 'Pie', fileName: 'doc' },
    });
    expect(editor.getHTML()).toContain('Hola');
    expect(editor.getHTML()).not.toContain('onerror');
    expect(editor.getDocument()).toMatchObject({ version: 1, header: 'Cab', footer: 'Pie', fileName: 'doc' });
  });

  it('emits change when the header/footer change (setDocument), with the new values', async () => {
    const { editor } = await mount({ content: '<p>a</p>' });
    const changes: string[] = [];
    editor.on('change', ({ document }) => changes.push(document.header));
    await act(async () => {
      editor.setDocument({ header: 'Nueva cabecera' });
    });
    expect(changes.at(-1)).toBe('Nueva cabecera');
  });

  it('configure() switches language and can reset options to their defaults', async () => {
    const { el, editor } = await mount({ locale: 'es', hiddenTools: ['colors'] });
    const boldTitle = () => el.querySelector('.toolbar-btn')?.getAttribute('title');
    expect(boldTitle()).toBe('Negrita (Ctrl+B)');
    expect(el.querySelector('.toolbar-color')).toBeNull();
    await act(async () => {
      editor.configure({ locale: undefined, hiddenTools: undefined });
    });
    expect(boldTitle()).toBe('Bold (Ctrl+B)');
    expect(el.querySelector('.toolbar-color')).not.toBeNull();
  });

  it('does not mutate the options object passed by the caller', async () => {
    const options = { locale: 'es' };
    const { editor } = await mount(options);
    await act(async () => {
      editor.configure({ locale: 'en' });
    });
    expect(options).toEqual({ locale: 'es' });
  });

  it('applies theme variables and toggles read-only', async () => {
    const { el, editor } = await mount({ theme: { primary: '#7c3aed', workspaceBackground: 'url(x)' } });
    expect(el.style.getPropertyValue('--pdf-editor-primary')).toBe('#7c3aed');
    expect(el.style.getPropertyValue('--pdf-editor-workspace-bg')).toBe(''); // valor peligroso ignorado
    await act(async () => {
      editor.setReadOnly(true);
    });
    expect(el.querySelector('.editor-content')?.getAttribute('contenteditable')).toBe('false');
  });

  it('destroy() unmounts, emits destroy and later calls throw', async () => {
    const { el, editor } = await mount();
    const onDestroy = vi.fn();
    editor.on('destroy', onDestroy);
    await act(async () => {
      editor.destroy();
    });
    expect(onDestroy).toHaveBeenCalledOnce();
    expect(el.children).toHaveLength(0);
    expect(() => editor.getHTML()).toThrow(/destroyed/);
    // Se puede volver a montar en el mismo elemento
    let again!: EditorInstance;
    await act(async () => {
      again = createEditor(el, {});
    });
    editors.push(again);
  });

  it('keeps setReadOnly/configure called right after createEditor (before React mounts)', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let editor!: EditorInstance;
    await act(async () => {
      editor = createEditor(el);
      editor.setReadOnly(true);
      editor.configure({ locale: 'es' });
    });
    await act(async () => {
      await editor.ready;
    });
    editors.push(editor);
    expect(el.querySelector('.editor-content')?.getAttribute('contenteditable')).toBe('false');
    expect(el.querySelector('.toolbar-btn')?.getAttribute('title')).toBe('Negrita (Ctrl+B)');
  });

  it('ready rejects when destroyed before mounting', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const editor = createEditor(el);
    editor.destroy();
    await expect(editor.ready).rejects.toThrow(/destroyed/);
  });

  it('setDocument: getDocument reflects the new header/footer immediately', async () => {
    const { editor } = await mount();
    await act(async () => {
      editor.setDocument({ header: 'H2', footer: 'F2', fileName: 'n2', html: '<p>x</p>' });
      expect(editor.getDocument()).toMatchObject({ header: 'H2', footer: 'F2', fileName: 'n2' });
    });
  });

  it('a hostile locale does not break the editor', async () => {
    const { el } = await mount({ locale: 'constructor' });
    expect(el.querySelector('.toolbar-btn')?.getAttribute('title')).toBe('Bold (Ctrl+B)');
  });

  it('theme values: only colours and simple gradients', () => {
    for (const ok of ['#7c3aed', 'rgb(1, 2, 3)', 'hsla(200, 50%, 40%, .5)', 'rebeccapurple', 'linear-gradient(180deg, #fff 0%, #eee 100%)']) {
      expect(isSafeThemeValue(ok)).toBe(true);
    }
    for (const bad of ['url(x)', 'image-set("https://e.x/p" 1x)', 'red; background: url(x)', '\\75 rl(x)', 'var(--x)', 'linear-gradient(red, url(x))', 'element(#a)']) {
      expect(isSafeThemeValue(bad)).toBe(false);
    }
  });

  it('destroy() restores the container style and classes', async () => {
    const el = document.createElement('div');
    el.className = 'host keep';
    el.setAttribute('style', 'color: red;');
    document.body.appendChild(el);
    let editor!: EditorInstance;
    await act(async () => {
      editor = createEditor(el, { className: 'extra', style: { height: '500px' }, theme: { primary: '#000' } });
    });
    await act(async () => {
      editor.destroy();
    });
    expect(el.getAttribute('style')).toBe('color: red;');
    expect(el.className).toBe('host keep');
  });

  it('setDocument with html + header emits a single change', async () => {
    const { editor } = await mount({ content: '<p>a</p>' });
    const onChange = vi.fn();
    editor.on('change', onChange);
    await act(async () => {
      editor.setDocument({ header: 'Nueva', html: '<p>b</p>' });
    });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].document.header).toBe('Nueva');
  });

  it('setReadOnly(true) blocks commands immediately', async () => {
    const { editor } = await mount();
    const spy = vi.spyOn(document, 'execCommand');
    editor.setReadOnly(true);
    editor.execute('bold');
    editor.insertTable();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('async failures are also emitted as error events', async () => {
    const { editor } = await mount();
    const onError = vi.fn();
    editor.on('error', onError);
    await act(async () => {
      editor.destroy();
    });
    // Tras destroy() ya no hay listeners: se comprueba con una instancia viva que falla al imprimir
    const { editor: other } = await mount();
    other.on('error', onError);
    const iframeAppend = vi.spyOn(document.body, 'appendChild').mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    await expect(other.print()).rejects.toThrow('blocked');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'blocked' }));
    iframeAppend.mockRestore();
  });

  it('setDocument: html-only and meta-only updates each emit exactly one change', async () => {
    const { editor } = await mount({ content: '<p>a</p>', header: 'H' });
    const onChange = vi.fn();
    editor.on('change', onChange);
    await act(async () => {
      editor.setDocument({ html: '<p>b</p>', header: 'H' }); // cabecera igual
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    await act(async () => {
      editor.setDocument({ header: 'Otra' }); // solo metadatos
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0].document.header).toBe('Otra');
  });

  it('refuses to mount twice on the same element', async () => {
    const { el } = await mount();
    expect(() => createEditor(el)).toThrow(/already mounted/);
  });

  it('exportHtml returns a standalone sanitized document', async () => {
    const { editor } = await mount({ content: '<h1>Título</h1><script>alert(1)</script>', header: 'A & B' });
    const html = editor.exportHtml();
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<h1>Título</h1>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('A &amp; B');
  });
});
