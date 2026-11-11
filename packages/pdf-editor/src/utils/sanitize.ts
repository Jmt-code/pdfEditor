import DOMPurify from 'dompurify';

/** Escapa texto para insertarlo como HTML */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const CSS_COLOR = '(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\\([\\d\\s.,%/deg-]+\\)|[a-z]{3,20})';
const SAFE_COLOR_RE = new RegExp(`^${CSS_COLOR}$`, 'i');
const SAFE_GRADIENT_RE = new RegExp(
  `^(?:repeating-)?linear-gradient\\((?:\\s*(?:to [a-z ]+|-?[\\d.]+deg|${CSS_COLOR}(?:\\s+-?[\\d.]+%)?)\\s*,?)+\\)$`,
  'i'
);

/** Color CSS simple (hex, rgb/hsl numéricos o nombre) */
export function isSafeCssColor(value: string): boolean {
  return SAFE_COLOR_RE.test(value.trim());
}

/** Color o degradado lineal simple: nada que pueda cargar recursos (url, image-set...) */
export function isSafeCssBackground(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 200 || /\\|url|image|element|attr|var\(|expression|[;{}<>@]/i.test(v)) return false;
  return SAFE_COLOR_RE.test(v) || SAFE_GRADIENT_RE.test(v);
}

/** Valores CSS nunca permitidos (recursos externos, expresiones, escapes, comentarios, HTML) */
const DANGEROUS_CSS = /url\s*\(|expression|var\s*\(|@|\\|\/\*|<|>|javascript:/i;

export function isSafeUrl(url: string, kind: 'link' | 'image'): boolean {
  if (!url || /[\u0000-\u0020\u007f-\u009f]/.test(url)) return false;
  // Rutas relativas (mismo origen, sin esquema): válidas para enlaces e imágenes
  const isRelative = !/^[^/?#]*:/.test(url) && !url.includes('\\');
  if (kind === 'image') {
    return isRelative || /^https?:\/\//i.test(url) || /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/]+={0,2}$/i.test(url);
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return true;
  return isRelative;
}

export function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'hr', 'span', 'font', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'style', 'color', 'face', 'size', 'colspan', 'rowspan', 'data-page-break'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  template.content.querySelectorAll('*').forEach((element) => {
    for (const attribute of ['colspan', 'rowspan']) {
      const value = element.getAttribute(attribute);
      if (value !== null && (!/^[1-9]\d*$/.test(value) || Number(value) > 50)) element.removeAttribute(attribute);
    }
    if (element.hasAttribute('data-page-break')) {
      const value = element.getAttribute('data-page-break');
      // Solo marcadores vacíos: un salto de página no puede envolver contenido
      const empty = !element.textContent?.trim() && !element.querySelector('img, table, hr');
      if (['DIV', 'HR'].includes(element.tagName) && empty && (value === '' || value === 'true')) element.setAttribute('data-page-break', 'true');
      else element.removeAttribute('data-page-break');
    }
    for (const attribute of ['href', 'src']) {
      const value = element.getAttribute(attribute);
      if (value !== null && !isSafeUrl(value, attribute === 'href' ? 'link' : 'image')) {
        element.removeAttribute(attribute);
      }
    }
    if (element.hasAttribute('style')) {
      element.setAttribute('style', (element.getAttribute('style') || '').split(';').filter((declaration) => !DANGEROUS_CSS.test(declaration)).join(';'));
      const style = (element as HTMLElement).style;
      const allowed = ['color', 'background-color', 'text-align', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'line-height', 'margin-left', 'padding-left', 'text-indent', 'border', 'border-collapse', 'width', 'vertical-align'];
      for (const property of Array.from(style)) {
        const value = style.getPropertyValue(property);
        const length = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|pt|em|rem|%|cm|mm)$/i;
        const isLength = ['font-size', 'margin-left', 'padding-left', 'text-indent', 'width'].includes(property);
        // Los navegadores reales enumeran el atajo `border` como propiedades largas
        // (border-top-width, border-left-style...): se validan igual que `border`
        const borderLonghand = /^border-(?:top|right|bottom|left)-(width|style|color)$/.exec(property);
        if (borderLonghand) {
          const kind = borderLonghand[1];
          const ok = !DANGEROUS_CSS.test(value) && (
            kind === 'width' ? length.test(value) || /^(thin|medium|thick)$/i.test(value)
              : kind === 'style' ? /^(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/i.test(value)
                : isSafeCssColor(value)
          );
          if (!ok) style.removeProperty(property);
          continue;
        }
        // Tamaños por palabra clave (Chrome los genera al fusionar bloques con <font size>)
        if (property === 'font-size' && /^(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/i.test(value)) continue;
        if (!allowed.includes(property) || DANGEROUS_CSS.test(value)
          || (isLength && !length.test(value))
          || (property === 'line-height' && !length.test(value) && !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))
          || (property === 'vertical-align' && !length.test(value) && !/^(baseline|sub|super|text-top|text-bottom|middle|top|bottom)$/i.test(value))
          || (property === 'border' && (value.replace(/#[0-9a-f]+|rgba?\([^)]*\)|hsla?\([^)]*\)/gi, '').match(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)[a-z%]+/gi) || []).some((part) => !length.test(part)))
          || (property === 'width' && !['TD', 'TH', 'TABLE', 'COL'].includes(element.tagName))) style.removeProperty(property);
      }
      if (!style.cssText) element.removeAttribute('style');
    }
    if (element.getAttribute('target') === '_blank') element.setAttribute('rel', 'noopener noreferrer');
  });
  return template.innerHTML;
}

/** Limpieza de portapapeles; las listas de Office se aplanan a un solo nivel. */
export function sanitizePastedHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  template.content.querySelectorAll('xml, style, meta, link, title, script').forEach((element) => element.remove());
  template.content.querySelectorAll('*').forEach((element) => {
    if (/^(?:o|w|m|v):/i.test(element.tagName)) element.remove();
  });
  template.content.querySelectorAll('p').forEach((paragraph) => {
    if (!/\bMsoListParagraph/i.test(paragraph.className) || !/mso-list\s*:/i.test(paragraph.getAttribute('style') || '')) return;
    const marker = paragraph.querySelector('span');
    if (!marker || !/^\s*(?:[•·●○▪\uF0B7-\uF0FF]|\d+[.)]|[a-zA-Z][.)])\s*$/.test(marker.textContent || '')) return;
    const tag = /^\s*(?:\d+|[a-zA-Z])[.)]/.test(marker.textContent || '') ? 'ol' : 'ul';
    marker.remove();
    let previous = paragraph.previousSibling;
    while (previous?.nodeType === Node.TEXT_NODE && !previous.textContent?.trim()) previous = previous.previousSibling;
    const list = previous instanceof HTMLElement && previous.localName === tag ? previous : document.createElement(tag);
    if (list !== previous) paragraph.before(list);
    const item = document.createElement('li');
    item.append(...Array.from(paragraph.childNodes));
    list.append(item);
    paragraph.remove();
  });
  template.content.querySelectorAll('*').forEach((element) => {
    if (element.localName === 'b' && element.id.startsWith('docs-internal-guid-') && (element as HTMLElement).style.fontWeight === 'normal') {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }
    element.removeAttribute('class');
    const style = (element as HTMLElement).style;
    for (const property of Array.from(style)) if (property.startsWith('mso-')) style.removeProperty(property);
    if (element.localName === 'span') {
      const formats: [string, string, RegExp][] = [['font-weight', 'strong', /^(700|bold)$/i], ['font-style', 'em', /^italic$/i], ['text-decoration', 'u', /underline/i], ['text-decoration', 's', /line-through/i]];
      for (const [property, tag, pattern] of formats) {
        if (!pattern.test(style.getPropertyValue(property))) continue;
        const wrapper = document.createElement(tag);
        wrapper.append(...Array.from(element.childNodes));
        element.append(wrapper);
      }
      // El formato ya está expresado con etiquetas: quitarlo del estilo para no duplicarlo
      for (const [property, , pattern] of formats) {
        if (pattern.test(style.getPropertyValue(property))) style.removeProperty(property);
      }
      // Un <span> sin estilo ni atributos no aporta nada
      if (!style.cssText && element.attributes.length <= 1) {
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }
    }
    if (!style.cssText) element.removeAttribute('style');
    if (element.localName === 'font' && !element.attributes.length) element.replaceWith(...Array.from(element.childNodes));
  });
  // Se ignoran los espacios entre párrafos vacíos consecutivos.
  template.content.querySelectorAll('p').forEach((paragraph) => {
    if (paragraph.textContent?.replace(/\u00a0/g, '').trim() || paragraph.querySelector('img, table, hr')) return;
    let next = paragraph.nextSibling;
    while (next?.nodeType === Node.TEXT_NODE && !next.textContent?.trim()) next = next.nextSibling;
    if (next instanceof HTMLParagraphElement && !next.textContent?.replace(/\u00a0/g, '').trim() && !next.querySelector('img, table, hr')) paragraph.remove();
  });
  return sanitizeHtml(template.innerHTML);
}
