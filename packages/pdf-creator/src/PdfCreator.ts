
export interface TextOptions {
  size?: number;
  font?: string; // 'helvetica', 'times', 'courier'
  style?: 'normal' | 'bold' | 'italic' | 'bolditalic';
  color?: string; // hex
  align?: 'left' | 'center' | 'right';
}

export interface ImageOptions {
  width: number;
  height: number;
  format?: string;
}

export interface DefaultHeaderConfig {
  text?: string;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

export interface DefaultFooterConfig {
  text?: string;
  showPageNumbers?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
}

export interface PdfConfig {
  headerHeight?: number;
  footerHeight?: number;
  onHeader?: (doc: PdfCreator, pageNumber: number) => void;
  onFooter?: (doc: PdfCreator, pageNumber: number) => void;
  defaultHeader?: DefaultHeaderConfig;
  defaultFooter?: DefaultFooterConfig;
}

interface PdfObject {
  id: number;
  offset: number;
  content: string | Uint8Array;
}

interface Page {
  id: number;
  contentId: number;
  content: string[];
  resources: {
    fonts: Set<string>;
    images: Set<string>;
  };
}

export class PdfCreator {
  private config: PdfConfig;
  private objects: PdfObject[] = [];
  private pages: Page[] = [];
  private currentPageIndex: number = -1;
  private objectCounter: number = 1;
  private images: Map<string, { id: number, width: number, height: number, data: string }> = new Map();
  private fonts: Map<string, number> = new Map(); // FontKey -> ObjectId

  private readonly PAGE_WIDTH = 595.28;
  private readonly PAGE_HEIGHT = 841.89;
  private readonly MAX_HEADER_HEIGHT = 200;
  private readonly MAX_FOOTER_HEIGHT = 200;

  private headerHeight: number = 0;
  private footerHeight: number = 0;
  private isApplyingHeaderFooter: boolean = false;

  // Standard 14 Fonts mapping
  private standardFonts: Record<string, string> = {
    'helvetica': 'Helvetica',
    'helvetica-bold': 'Helvetica-Bold',
    'helvetica-italic': 'Helvetica-Oblique',
    'helvetica-bolditalic': 'Helvetica-BoldOblique',
    'times': 'Times-Roman',
    'times-bold': 'Times-Bold',
    'times-italic': 'Times-Italic',
    'times-bolditalic': 'Times-BoldItalic',
    'courier': 'Courier',
    'courier-bold': 'Courier-Bold',
    'courier-italic': 'Courier-Oblique',
    'courier-bolditalic': 'Courier-BoldOblique',
  };

  private canvasContext: CanvasRenderingContext2D | null = null;

  constructor(config: PdfConfig = {}) {
    this.config = config;
    
    // Initialize and clamp header/footer heights
    this.headerHeight = Math.min(config.headerHeight || 0, this.MAX_HEADER_HEIGHT);
    this.footerHeight = Math.min(config.footerHeight || 0, this.MAX_FOOTER_HEIGHT);

    this.addPage(); // Start with one page
  }

  private getCanvasContext(): CanvasRenderingContext2D {
    if (!this.canvasContext) {
        const canvas = document.createElement('canvas');
        this.canvasContext = canvas.getContext('2d');
    }
    return this.canvasContext!;
  }

  public getTextWidth(text: string, options: TextOptions = {}): number {
    const ctx = this.getCanvasContext();
    const { size = 12, font = 'helvetica', style = 'normal' } = options;
    // Map PDF fonts to Canvas fonts roughly
    let fontName = 'Arial';
    if (font.toLowerCase().includes('times')) fontName = 'Times New Roman';
    if (font.toLowerCase().includes('courier')) fontName = 'Courier New';
    
    let fontStyle = '';
    if (style.includes('italic')) fontStyle += 'italic ';
    if (style.includes('bold')) fontStyle += 'bold ';

    ctx.font = `${fontStyle}${size}pt ${fontName}`;
    return ctx.measureText(text).width;
  }

  private getNextId(): number {
    return this.objectCounter++;
  }

  public addPage() {
    const pageId = this.getNextId();
    const contentId = this.getNextId();
    this.pages.push({
      id: pageId,
      contentId: contentId,
      content: [],
      resources: {
        fonts: new Set(),
        images: new Set()
      }
    });
    this.currentPageIndex = this.pages.length - 1;
  }

  // Helper to switch context to a specific page (for header/footer)
  private setPage(index: number) {
    if (index >= 0 && index < this.pages.length) {
      this.currentPageIndex = index;
    }
  }

  private hexToRgb(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
  }

  private escapeText(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  public addText(text: string, x: number, y: number, options: TextOptions = {}): number {
    const { size = 12, font = 'helvetica', style = 'normal', color = '#000000', align = 'left' } = options;
    
    // Check for footer overlap
    // If y + size > PAGE_HEIGHT - footerHeight, move to next page
    const footerStart = this.PAGE_HEIGHT - this.footerHeight;
    if (!this.isApplyingHeaderFooter && y + size > footerStart) {
        this.addPage();
        // Reset Y to top of printable area (headerHeight + margin)
        y = this.headerHeight + 20; 
    }

    // PDF coordinate system starts at bottom-left. 
    // Assuming A4 (595.28 x 841.89 points) and user expects top-left origin.
    // We need to flip Y.
    const pdfY = this.PAGE_HEIGHT - y;

    const fontKey = `${font.toLowerCase()}-${style.toLowerCase()}`.replace(/-normal$/, '');
    const pdfFontName = this.standardFonts[fontKey] || 'Helvetica';
    
    // Register font if needed (we'll assign IDs later or now)
    // For simplicity, we'll use standard fonts which don't need embedding, just resource declaration.
    const fontResourceName = `F${Object.keys(this.standardFonts).indexOf(fontKey) + 1}`;
    
    const currentPage = this.pages[this.currentPageIndex];
    currentPage.resources.fonts.add(fontResourceName);

    const rgb = this.hexToRgb(color);

    let content = `BT\n`;
    content += `/${fontResourceName} ${size} Tf\n`;
    content += `${rgb.r} ${rgb.g} ${rgb.b} rg\n`;
    
    // Simple alignment adjustment (very rough approximation for width)
    let xOffset = x;
    if (align === 'center') {
        xOffset -= (text.length * size * 0.3); // Rough estimate
    } else if (align === 'right') {
        xOffset -= (text.length * size * 0.6); // Rough estimate
    }

    content += `${xOffset} ${pdfY} Td\n`;
    content += `(${this.escapeText(text)}) Tj\n`;
    content += `ET\n`;

    currentPage.content.push(content);
    
    return y;
  }

  private async processImage(source: string): Promise<string> {
    let dataUrl = source;

    // 1. If it's a URL, fetch it
    if (source.startsWith('http://') || source.startsWith('https://')) {
        try {
            const response = await fetch(source);
            const blob = await response.blob();
            dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Error fetching image URL:', error);
            throw error;
        }
    }

    // 2. Convert to JPEG using Canvas (to ensure compatibility with DCTDecode)
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
            }
            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (e) => reject(new Error('Failed to load image for conversion'));
        img.src = dataUrl;
    });
  }

  public async addImage(imageData: string, x: number, y: number, options: ImageOptions): Promise<number> {
    // Check for footer overlap
    const footerStart = this.PAGE_HEIGHT - this.footerHeight;
    if (!this.isApplyingHeaderFooter && y + options.height > footerStart) {
        this.addPage();
        // Reset Y to top of printable area
        y = this.headerHeight + 20;
    }

    // Process image (fetch URL if needed, convert to JPEG)
    const processedData = await this.processImage(imageData);

    // imageData is expected to be base64
    // We need to strip the data:image/jpeg;base64, prefix if present
    const base64Data = processedData.replace(/^data:image\/\w+;base64,/, "");
    
    // Store image data to be written as an object later
    // Use a hash or simple counter for key
    const imageKey = `I${this.images.size + 1}`;
    
    if (!this.images.has(imageKey)) {
        this.images.set(imageKey, {
            id: this.getNextId(),
            width: options.width,
            height: options.height,
            data: base64Data
        });
    }
    
    const imageObj = this.images.get(imageKey)!;
    const currentPage = this.pages[this.currentPageIndex];
    currentPage.resources.images.add(imageKey);

    const pdfY = this.PAGE_HEIGHT - y - options.height; // Bottom-left of image

    // q w 0 0 h x y cm /Name Do Q
    // w = width, h = height
    currentPage.content.push(`q ${options.width} 0 0 ${options.height} ${x} ${pdfY} cm /${imageKey} Do Q\n`);
    
    return y;
  }

  private applyHeaderFooter() {
    this.isApplyingHeaderFooter = true;
    const originalPageIndex = this.currentPageIndex;
    for (let i = 0; i < this.pages.length; i++) {
        this.setPage(i);
        const pageNum = i + 1;

        // Header
        if (this.config.onHeader) {
            this.config.onHeader(this, pageNum);
        } else if (this.config.defaultHeader) {
             const { text = '', align = 'center', color = '#000000' } = this.config.defaultHeader;
             if (text) {
                 let x = 20;
                 if (align === 'center') x = this.PAGE_WIDTH / 2;
                 if (align === 'right') x = this.PAGE_WIDTH - 20;
                 this.addText(text, x, 20, { size: 10, align, color });
             }
        }

        // Footer
        if (this.config.onFooter) {
            this.config.onFooter(this, pageNum);
        } else if (this.config.defaultFooter) {
            const { text = '', showPageNumbers = true, align = 'center', color = '#000000' } = this.config.defaultFooter;
            let footerText = text;
            if (showPageNumbers) {
                footerText = text ? `${text} - Page ${pageNum}` : `Page ${pageNum}`;
            }
            
            if (footerText) {
                 let x = 20;
                 if (align === 'center') x = this.PAGE_WIDTH / 2;
                 if (align === 'right') x = this.PAGE_WIDTH - 20;
                 // Use a reasonable default Y position. A4 height is ~841.
                 this.addText(footerText, x, 820, { size: 10, align, color });
            }
        }
    }
    this.currentPageIndex = originalPageIndex;
    this.isApplyingHeaderFooter = false;
  }

  private buildPdf(): Uint8Array {
    // 1. Apply Header/Footer
    this.applyHeaderFooter();

    // 2. Start building objects
    let buffer = `%PDF-1.7\n`;
    let currentOffset = buffer.length;
    const xref: number[] = [0]; // Object 0 is special

    const addObject = (id: number, content: string) => {
        xref[id] = currentOffset;
        const objHeader = `${id} 0 obj\n`;
        const objFooter = `\nendobj\n`;
        const fullObj = objHeader + content + objFooter;
        buffer += fullObj;
        currentOffset += fullObj.length;
    };

    // 3. Catalog
    const catalogId = this.getNextId();
    const pagesRootId = this.getNextId();
    
    addObject(catalogId, `<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`);

    // 4. Pages Root
    const pageIds = this.pages.map(p => `${p.id} 0 R`).join(' ');
    addObject(pagesRootId, `<< /Type /Pages /Kids [${pageIds}] /Count ${this.pages.length} >>`);

    // 5. Page Objects and Content Streams
    this.pages.forEach(page => {
        // Build Resources Dictionary
        let fontRes = '';
        if (page.resources.fonts.size > 0) {
            fontRes += '/Font << ';
            page.resources.fonts.forEach(f => {
                // Map F1 -> Helvetica, etc.
                // We need to find which font key corresponds to F1, F2...
                // For this simple implementation, we'll just iterate standardFonts
                // In a real impl, we'd map properly.
                // Hack: We used index in standardFonts keys for F-number
                const fontIndex = parseInt(f.substring(1)) - 1;
                const fontKey = Object.keys(this.standardFonts)[fontIndex];
                const fontName = this.standardFonts[fontKey];
                fontRes += `/${f} << /Type /Font /Subtype /Type1 /BaseFont /${fontName} >> `;
            });
            fontRes += '>>';
        }

        let xObjectRes = '';
        if (page.resources.images.size > 0) {
            xObjectRes += '/XObject << ';
            page.resources.images.forEach(imgKey => {
                const img = this.images.get(imgKey)!;
                xObjectRes += `/${imgKey} ${img.id} 0 R `;
            });
            xObjectRes += '>>';
        }

        const resources = `<< ${fontRes} ${xObjectRes} >>`;

        addObject(page.id, `<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 595.28 841.89] /Contents ${page.contentId} 0 R /Resources ${resources} >>`);
        
        const streamContent = page.content.join('\n');
        addObject(page.contentId, `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`);
    });

    // 6. Images
    this.images.forEach((img) => {
        // We need to decode base64 to raw bytes for the stream
        // In browser JS, atob works. In Node, Buffer.
        // Since this is a library, we should handle both or assume environment.
        // For this example, we'll assume browser environment (atob) or polyfill.
        
        const binaryString = atob(img.data);
        const len = binaryString.length;
        // We can't easily append binary data to our string buffer without encoding issues.
        // So we should switch to Uint8Array for the whole buffer construction ideally.
        // But for simplicity, we will treat the whole PDF as a binary string (Latin1).
        
        // NOTE: This is a simplification. Real PDF generation should use Uint8Array buffers.
        // I will try to keep it as string but use a trick for binary.
        
        addObject(img.id, `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${len} >>\nstream\n${binaryString}\nendstream`);
    });

    // 7. XRef
    const xrefOffset = currentOffset;
    buffer += `xref\n0 ${this.objectCounter}\n0000000000 65535 f \n`;
    for (let i = 1; i < this.objectCounter; i++) {
        const offset = xref[i];
        buffer += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }

    // 8. Trailer
    buffer += `trailer\n<< /Size ${this.objectCounter} /Root ${catalogId} 0 R >>\n`;
    buffer += `startxref\n${xrefOffset}\n%%EOF`;

    // Convert string to Uint8Array
    const rawLength = buffer.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for(let i = 0; i < rawLength; i++) {
        array[i] = buffer.charCodeAt(i) & 0xff;
    }
    return array;
  }

  public save(filename: string) {
    const bytes = this.buildPdf();
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }
  
  public getOutput(): Blob {
    const bytes = this.buildPdf();
    return new Blob([bytes as any], { type: 'application/pdf' });
  }
}
