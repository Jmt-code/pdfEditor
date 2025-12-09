import React, { useState } from 'react';
import { PdfCreator } from '@jmt-code/pdf-creator';
import './PdfEditor.css';

interface BlockStyle {
  textAlign: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
}

interface DocumentBlock {
  id: string;
  type: 'text' | 'image';
  content: string; // HTML for text, URL for image
  style: BlockStyle;
}

const DEFAULT_STYLE: BlockStyle = {
  textAlign: 'left'
};

export const PdfEditor: React.FC = () => {
  const [blocks, setBlocks] = useState<DocumentBlock[]>([
    { id: '1', type: 'text', content: '<div style="text-align: center;"><font size="6"><b>Welcome to PDF Editor</b></font></div>', style: { ...DEFAULT_STYLE, textAlign: 'center' } },
    { id: '2', type: 'text', content: 'Start typing here...', style: { ...DEFAULT_STYLE } }
  ]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>('2');
  
  // Header & Footer State
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('Page {pageNumber}');

  const updateBlock = (id: string, changes: Partial<DocumentBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...changes } : b));
  };

  const addTextBlock = () => {
    const newBlock: DocumentBlock = {
      id: Date.now().toString(),
      type: 'text',
      content: '',
      style: { ...DEFAULT_STYLE }
    };
    setBlocks([...blocks, newBlock]);
    setActiveBlockId(newBlock.id);
  };

  const addImageBlock = async () => {
    const url = prompt('Enter Image URL:');
    if (url) {
      const newBlock: DocumentBlock = {
        id: Date.now().toString(),
        type: 'image',
        content: url,
        style: { ...DEFAULT_STYLE, width: 200, height: 200, textAlign: 'center' }
      };
      setBlocks([...blocks, newBlock]);
      setActiveBlockId(newBlock.id);
    }
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (activeBlockId === id) setActiveBlockId(null);
  };

  const execCmd = (command: string, value: any = null) => {
    document.execCommand(command, false, value);
    // Force update content of active block
    if (activeBlockId) {
        const el = document.getElementById(`editable-${activeBlockId}`);
        if (el) {
            updateBlock(activeBlockId, { content: el.innerHTML });
        }
    }
  };

  const handleToolbarAction = (action: string, value?: any) => {
    if (!activeBlockId) return;
    const block = blocks.find(b => b.id === activeBlockId);
    if (!block) return;

    // Focus the editable element before executing command
    if (block.type === 'text') {
        const el = document.getElementById(`editable-${activeBlockId}`);
        if (el) el.focus();
    }

    switch (action) {
      case 'bold': execCmd('bold'); break;
      case 'italic': execCmd('italic'); break;
      case 'underline': execCmd('underline'); break;
      case 'justifyLeft': 
        execCmd('justifyLeft'); 
        updateBlock(activeBlockId, { style: { ...block.style, textAlign: 'left' } });
        break;
      case 'justifyCenter': 
        execCmd('justifyCenter'); 
        updateBlock(activeBlockId, { style: { ...block.style, textAlign: 'center' } });
        break;
      case 'justifyRight': 
        execCmd('justifyRight'); 
        updateBlock(activeBlockId, { style: { ...block.style, textAlign: 'right' } });
        break;
      case 'fontSize': execCmd('fontSize', value); break; // 1-7
      case 'foreColor': execCmd('foreColor', value); break;
      case 'fontName': execCmd('fontName', value); break;
      case 'image': addImageBlock(); break;
      case 'delete': removeBlock(activeBlockId); break;
    }
  };

  // HTML Parser for PDF Generation
  const parseHtmlToPdf = async (pdf: PdfCreator, html: string, startX: number, startY: number, width: number) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    let currentX = startX;
    let currentY = startY;

    // Recursive function to traverse nodes
    const traverse = (node: Node, style: any) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (!text.trim()) return;

            const words = text.split(/(\s+)/); // Split by whitespace but keep delimiters
            
            for (const word of words) {
                const textWidth = pdf.getTextWidth(word, style);
                
                // Check for line wrap
                if (currentX + textWidth > startX + width) {
                    currentY += (style.size || 12) * 1.2;
                    currentX = startX;
                }

                // Handle alignment (rough) - actually alignment is hard with streaming text
                // For now we assume left align flow, or we need to buffer lines.
                // To keep it simple for this iteration, we just print.
                
                pdf.addText(word, currentX, currentY, style);
                currentX += textWidth;
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const newStyle = { ...style };
            
            if (el.tagName === 'B' || el.style.fontWeight === 'bold') newStyle.style = (newStyle.style || '') + 'bold';
            if (el.tagName === 'I' || el.style.fontStyle === 'italic') newStyle.style = (newStyle.style || '') + 'italic';
            if (el.tagName === 'FONT') {
                if (el.getAttribute('color')) newStyle.color = el.getAttribute('color');
                if (el.getAttribute('size')) {
                    // Map HTML size 1-7 to pt
                    const sizes: Record<string, number> = { '1': 8, '2': 10, '3': 12, '4': 14, '5': 18, '6': 24, '7': 36 };
                    newStyle.size = sizes[el.getAttribute('size')!] || 12;
                }
                if (el.getAttribute('face')) newStyle.font = el.getAttribute('face');
            }
            if (el.style.color) newStyle.color = el.style.color;
            if (el.style.fontSize) newStyle.size = parseInt(el.style.fontSize);
            if (el.style.fontFamily) newStyle.font = el.getAttribute('face')!;

            // Handle block elements (div, p) -> new line
            if (['DIV', 'P', 'BR'].includes(el.tagName)) {
                if (currentX > startX) {
                    currentY += (style.size || 12) * 1.2;
                    currentX = startX;
                }
            }

            el.childNodes.forEach(child => traverse(child, newStyle));
            
            if (['DIV', 'P'].includes(el.tagName)) {
                 if (currentX > startX) {
                    currentY += (style.size || 12) * 1.2;
                    currentX = startX;
                }
            }
        }
    };

    traverse(tempDiv, { size: 12, font: 'helvetica', style: 'normal', color: '#000000' });
    return currentY + 20; // Return next Y
  };

  const generatePdf = async () => {
    const pdf = new PdfCreator({
      headerHeight: 40,
      footerHeight: 40,
      defaultHeader: headerText ? { text: headerText, align: 'center' } : undefined,
      defaultFooter: footerText ? { text: footerText.replace('{pageNumber}', ''), showPageNumbers: footerText.includes('{pageNumber}'), align: 'center' } : undefined
    });

    let currentY = 40;
    const marginX = 40;
    const pageWidth = 595.28;
    const contentWidth = pageWidth - (marginX * 2);

    for (const block of blocks) {
      if (block.type === 'text') {
        // Use the HTML parser
        currentY = await parseHtmlToPdf(pdf, block.content, marginX, currentY, contentWidth);
      } else if (block.type === 'image') {
        const width = block.style.width || 200;
        const height = block.style.height || 200;
        let imgX = marginX;
        if (block.style.textAlign === 'center') imgX = (pageWidth - width) / 2;
        else if (block.style.textAlign === 'right') imgX = pageWidth - marginX - width;

        const drawnY = await pdf.addImage(block.content, imgX, currentY, { width, height });
        currentY = drawnY + height + 20;
      }
    }

    pdf.save('document.pdf');
  };

  return (
    <div className="pdf-editor-container">
      {/* Toolbar */}
      <div className="pdf-toolbar">
        <div className="toolbar-group">
          <select className="toolbar-select" onChange={(e) => handleToolbarAction('fontName', e.target.value)}>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times</option>
            <option value="Courier New">Courier</option>
          </select>
          <select className="toolbar-select" onChange={(e) => handleToolbarAction('fontSize', e.target.value)}>
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Huge</option>
          </select>
        </div>
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={() => handleToolbarAction('bold')}><strong>B</strong></button>
          <button className="toolbar-btn" onClick={() => handleToolbarAction('italic')}><em>I</em></button>
          <button className="toolbar-btn" onClick={() => handleToolbarAction('underline')}><u>U</u></button>
          <input type="color" className="toolbar-input-color" onChange={(e) => handleToolbarAction('foreColor', e.target.value)} />
        </div>
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={() => handleToolbarAction('justifyLeft')}>L</button>
          <button className="toolbar-btn" onClick={() => handleToolbarAction('justifyCenter')}>C</button>
          <button className="toolbar-btn" onClick={() => handleToolbarAction('justifyRight')}>R</button>
        </div>
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={() => handleToolbarAction('image')}>📷</button>
          <button className="toolbar-btn" onClick={() => handleToolbarAction('delete')} style={{ color: 'red' }}>×</button>
        </div>
      </div>

      {/* Workspace */}
      <div className="pdf-workspace">
        <div className="pdf-page">
          <div className="pdf-header-editor">
            <span className="area-label">Header</span>
            <textarea 
              className="editor-textarea" 
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder="Header text..."
              style={{ textAlign: 'center', fontSize: '10pt' }}
            />
          </div>

          <div className="pdf-content-area">
            {blocks.map(block => (
              <div 
                key={block.id} 
                className={`editor-block ${activeBlockId === block.id ? 'focused' : ''}`}
                onClick={() => setActiveBlockId(block.id)}
                style={{ textAlign: block.style.textAlign }}
              >
                {block.type === 'text' ? (
                  <div
                    id={`editable-${block.id}`}
                    className="editor-contenteditable"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateBlock(block.id, { content: e.currentTarget.innerHTML })}
                    dangerouslySetInnerHTML={{ __html: block.content }}
                    style={{ minHeight: '1.5em', outline: 'none' }}
                  />
                ) : (
                  <div className="editor-image-container">
                    <img src={block.content} className="editor-image" style={{ width: block.style.width, height: block.style.height }} />
                  </div>
                )}
              </div>
            ))}
            <div className="add-block-area" onClick={addTextBlock}>+ Add Paragraph</div>
          </div>

          <div className="pdf-footer-editor">
            <span className="area-label">Footer</span>
            <textarea 
              className="editor-textarea" 
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Footer text..."
              style={{ textAlign: 'center', fontSize: '10pt' }}
            />
          </div>
        </div>
      </div>

      <button className="floating-action-btn" onClick={generatePdf}>⬇ PDF</button>
    </div>
  );
};
