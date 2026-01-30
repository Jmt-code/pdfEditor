import { useCallback, RefObject } from 'react';
import type { TextFormat } from '../types';

/**
 * Hook para manejar los comandos del editor
 */
export function useEditorCommands(
  editorRef: RefObject<HTMLDivElement | null>,
  onFormatsChange: (formats: Set<TextFormat>) => void,
  onContentChange?: () => void
) {
  /**
   * Actualiza los formatos activos basándose en la selección actual
   */
  const updateActiveFormats = useCallback(() => {
    const formats = new Set<TextFormat>();
    
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikeThrough')) formats.add('strikethrough');
    if (document.queryCommandState('insertUnorderedList')) formats.add('ul');
    if (document.queryCommandState('insertOrderedList')) formats.add('ol');
    if (document.queryCommandState('justifyLeft')) formats.add('left');
    if (document.queryCommandState('justifyCenter')) formats.add('center');
    if (document.queryCommandState('justifyRight')) formats.add('right');
    if (document.queryCommandState('justifyFull')) formats.add('justify');
    
    onFormatsChange(formats);
  }, [onFormatsChange]);

  /**
   * Ejecuta un comando del editor
   */
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateActiveFormats();
    
    // Notificar cambio de contenido
    if (onContentChange) {
      setTimeout(onContentChange, 0);
    }
  }, [editorRef, updateActiveFormats, onContentChange]);

  /**
   * Formatea un bloque (h1, h2, p, etc.)
   */
  const formatBlock = useCallback((tag: string) => {
    execCommand('formatBlock', tag);
  }, [execCommand]);

  /**
   * Inserta un enlace
   */
  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  }, [execCommand]);

  /**
   * Inserta una imagen
   */
  const insertImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url) {
      execCommand('insertImage', url);
    }
  }, [execCommand]);

  /**
   * Inserta una imagen desde un archivo
   */
  const insertImageFromFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          execCommand('insertImage', dataUrl);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }, [execCommand]);

  return {
    execCommand,
    formatBlock,
    insertLink,
    insertImage,
    insertImageFromFile,
    updateActiveFormats,
  };
}
