import { useCallback, RefObject } from 'react';

/**
 * Patrones de Markdown soportados
 */
const MARKDOWN_PATTERNS = {
  heading1: /^# $/,
  heading2: /^## $/,
  heading3: /^### $/,
  unorderedList: /^[-*] $/,
  orderedList: /^\d+\. $/,
  blockquote: /^> $/,
  codeBlock: /^```$/,
  horizontalRule: /^---$/,
  bold: /\*\*([^*]+)\*\*$/,
  italic: /(?<!\*)\*([^*]+)\*(?!\*)$/,
  strikethrough: /~~([^~]+)~~$/,
  inlineCode: /`([^`]+)`$/,
};

/**
 * Hook para manejar los atajos de Markdown
 */
export function useMarkdownShortcuts(
  editorRef: RefObject<HTMLDivElement | null>,
  execCommand: (command: string, value?: string) => void
) {
  /**
   * Reemplaza texto en el nodo actual
   */
  const replaceText = useCallback((node: Node, start: number, end: number, replacement: string) => {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    range.deleteContents();
    if (replacement) {
      range.insertNode(document.createTextNode(replacement));
    }
  }, []);

  /**
   * Procesa los atajos de Markdown al escribir
   */
  const handleMarkdownInput = useCallback(() => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection?.anchorNode) return;
    
    const node = selection.anchorNode;
    if (node.nodeType !== Node.TEXT_NODE) return;
    
    const text = node.textContent || '';
    const offset = selection.anchorOffset;
    
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const line = text.substring(lineStart, offset);

    // Headings
    if (MARKDOWN_PATTERNS.heading1.test(line)) {
      execCommand('formatBlock', 'h1');
      replaceText(node, lineStart, offset, '');
      return;
    }
    
    if (MARKDOWN_PATTERNS.heading2.test(line)) {
      execCommand('formatBlock', 'h2');
      replaceText(node, lineStart, offset, '');
      return;
    }
    
    if (MARKDOWN_PATTERNS.heading3.test(line)) {
      execCommand('formatBlock', 'h3');
      replaceText(node, lineStart, offset, '');
      return;
    }

    // Lists
    if (MARKDOWN_PATTERNS.unorderedList.test(line)) {
      execCommand('insertUnorderedList');
      replaceText(node, lineStart, offset, '');
      return;
    }
    
    if (MARKDOWN_PATTERNS.orderedList.test(line)) {
      execCommand('insertOrderedList');
      replaceText(node, lineStart, offset, '');
      return;
    }

    // Quote
    if (MARKDOWN_PATTERNS.blockquote.test(line)) {
      execCommand('formatBlock', 'blockquote');
      replaceText(node, lineStart, offset, '');
      return;
    }

    // Code block
    if (MARKDOWN_PATTERNS.codeBlock.test(line)) {
      execCommand('formatBlock', 'pre');
      replaceText(node, lineStart, offset, '');
      return;
    }

    // Horizontal rule
    if (MARKDOWN_PATTERNS.horizontalRule.test(line)) {
      execCommand('insertHorizontalRule');
      replaceText(node, lineStart, offset, '');
      return;
    }

    // Inline formatting
    const boldMatch = line.match(MARKDOWN_PATTERNS.bold);
    if (boldMatch) {
      const startIdx = lineStart + line.lastIndexOf('**' + boldMatch[1] + '**');
      replaceText(node, startIdx, offset, '');
      execCommand('insertHTML', `<strong>${boldMatch[1]}</strong> `);
      return;
    }

    const italicMatch = line.match(MARKDOWN_PATTERNS.italic);
    if (italicMatch && !boldMatch) {
      const startIdx = lineStart + line.lastIndexOf('*' + italicMatch[1] + '*');
      replaceText(node, startIdx, offset, '');
      execCommand('insertHTML', `<em>${italicMatch[1]}</em> `);
      return;
    }

    const strikeMatch = line.match(MARKDOWN_PATTERNS.strikethrough);
    if (strikeMatch) {
      const startIdx = lineStart + line.lastIndexOf('~~' + strikeMatch[1] + '~~');
      replaceText(node, startIdx, offset, '');
      execCommand('insertHTML', `<s>${strikeMatch[1]}</s> `);
      return;
    }

    const codeMatch = line.match(MARKDOWN_PATTERNS.inlineCode);
    if (codeMatch) {
      const startIdx = lineStart + line.lastIndexOf('`' + codeMatch[1] + '`');
      replaceText(node, startIdx, offset, '');
      execCommand('insertHTML', `<code>${codeMatch[1]}</code> `);
      return;
    }
  }, [editorRef, execCommand, replaceText]);

  return { handleMarkdownInput };
}
