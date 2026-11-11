import { useCallback, RefObject } from 'react';

/** Procesa Markdown sin interpretar el texto del usuario como HTML. */
export function useMarkdownShortcuts(
  editorRef: RefObject<HTMLDivElement | null>,
  execCommand: (command: string, value?: string) => void,
  disabled = false
) {
  const handleMarkdownInput = useCallback(() => {
    if (disabled || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !selection.anchorNode || !editorRef.current.contains(selection.anchorNode)) return;
    const node = selection.anchorNode;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const offset = selection.anchorOffset;
    const text = node.textContent || '';
    const start = text.lastIndexOf('\n', offset - 1) + 1;
    const line = text.slice(start, offset);
    // [  ]: Chrome escribe el espacio final de una línea como espacio duro
    const blocks: [RegExp, string, string?][] = [
      [/^#[  ]$/, 'formatBlock', 'h1'], [/^##[  ]$/, 'formatBlock', 'h2'],
      [/^###[  ]$/, 'formatBlock', 'h3'], [/^[-*][  ]$/, 'insertUnorderedList'],
      [/^\d+\.[  ]$/, 'insertOrderedList'], [/^>[  ]$/, 'formatBlock', 'blockquote'],
      [/^```$/, 'formatBlock', 'pre'], [/^---$/, 'insertHorizontalRule'],
    ];
    const block = blocks.find(([pattern]) => pattern.test(line));
    const range = document.createRange();
    if (block) {
      range.setStart(node, start);
      range.setEnd(node, offset);
      range.deleteContents();
      // Si el bloque queda vacío, Chrome necesita un <br> para aplicar el formato a ESTE bloque;
      // con un nodo de texto vacío puede formatear o fusionar el bloque vecino.
      const parent = node.parentNode;
      if (!node.textContent && parent && !(parent.textContent || '').trim()) {
        const br = document.createElement('br');
        parent.replaceChild(br, node);
        range.setStartBefore(br);
        range.collapse(true);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      execCommand(block[1], block[2]);
      return;
    }
    // Los atajos en línea se aplican al escribir el espacio tras el cierre ("**texto** "). Ese
    // espacio pasa a ser un espacio duro fuera del elemento: con un espacio normal Chrome lo
    // elimina al normalizar y el texto que se escribe después acaba dentro del <strong>/<em>.
    const inline: [RegExp, string][] = [
      [/\*\*([^*\s][^*]*)\*\*\s$/, 'strong'], [/(?<!\*)\*([^*\s][^*]*)\*\s$/, 'em'],
      [/~~([^~\s][^~]*)~~\s$/, 's'], [/`([^`]+)`\s$/, 'code'],
    ];
    for (const [pattern, tag] of inline) {
      const match = line.match(pattern);
      if (!match) continue;
      range.setStart(node, start + match.index!);
      range.setEnd(node, offset);
      range.deleteContents();
      const element = document.createElement(tag);
      element.textContent = match[1];
      const space = document.createTextNode(' ');
      const fragment = document.createDocumentFragment();
      fragment.append(element, space);
      range.insertNode(fragment);
      range.setStart(space, 1);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
  }, [editorRef, execCommand, disabled]);
  return { handleMarkdownInput };
}
