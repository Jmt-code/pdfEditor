import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkdownShortcuts } from '../hooks/useMarkdownShortcuts';

let root: Root;
let host: HTMLDivElement;
let editor: HTMLDivElement;
let run: () => void;
const command = vi.fn();
function Harness({ disabled = false }: { disabled?: boolean }) {
  run = useMarkdownShortcuts({ current: editor }, command, disabled).handleMarkdownInput;
  return null;
}
function select(text: string) {
  editor.textContent = text;
  const range = document.createRange();
  range.setStart(editor.firstChild!, text.length);
  range.collapse(true);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  editor = document.createElement('div');
  document.body.append(host, editor);
  root = createRoot(host);
  command.mockReset();
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  editor.remove();
  vi.unstubAllGlobals();
});
describe('Markdown', () => {
  it.each([['**<img onerror=x>** ', 'strong'], ['*hola* ', 'em'], ['~~hola~~ ', 's'], ['`<script>` ', 'code'], ['**hola** ', 'strong']])('inserta texto seguro %s', (text, tag) => {
    select(text);
    run();
    expect(editor.querySelector(tag)).not.toBeNull();
    expect(editor.querySelector('img,script')).toBeNull();
    const space = editor.querySelector(tag)!.nextSibling;
    // Espacio duro fuera del elemento: Chrome no lo elimina y el cursor queda fuera
    expect(space?.textContent).toBe(' ');
    expect(window.getSelection()!.anchorNode).toBe(space);
    expect(window.getSelection()!.anchorOffset).toBe(1);
    expect(command).not.toHaveBeenCalled();
  });
  it.each(['**hola**', '*hola*', 'a ** b ** '])('no convierte sin cierre seguido de espacio: %s', (text) => {
    select(text);
    run();
    expect(editor.textContent).toBe(text);
  });
  it.each(['# ', '## ', '### ', '- ', '1. ', '> ', '```', '---', '## ', '- '])('quita marcador antes del comando %s', (text) => {
    select(text);
    command.mockImplementation(() => expect(editor.textContent).toBe(''));
    run();
    expect(command).toHaveBeenCalledOnce();
  });
  it('respeta solo lectura', () => {
    act(() => root.render(<Harness disabled />));
    select('**hola**');
    run();
    expect(editor.textContent).toBe('**hola**');
    expect(command).not.toHaveBeenCalled();
  });
});
