import DOMPurify from 'dompurify';

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
    ALLOWED_TAGS: ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'hr', 'span', 'font'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'style', 'color', 'face', 'size'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const template = document.createElement('template');
  template.innerHTML = clean;
  template.content.querySelectorAll('*').forEach((element) => {
    for (const attribute of ['href', 'src']) {
      const value = element.getAttribute(attribute);
      if (value !== null && !isSafeUrl(value, attribute === 'href' ? 'link' : 'image')) {
        element.removeAttribute(attribute);
      }
    }
    if (element.hasAttribute('style')) {
      const style = (element as HTMLElement).style;
      const allowed = ['color', 'background-color', 'text-align', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line'];
      for (const property of Array.from(style)) {
        if (!allowed.includes(property) || /url\s*\(|expression|var\s*\(/i.test(style.getPropertyValue(property))) style.removeProperty(property);
      }
      if (!style.cssText) element.removeAttribute('style');
    }
    if (element.getAttribute('target') === '_blank') element.setAttribute('rel', 'noopener noreferrer');
  });
  return template.innerHTML;
}
