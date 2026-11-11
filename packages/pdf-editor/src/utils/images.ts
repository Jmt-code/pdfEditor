/** Formatos de imagen que se pueden insertar (pegar o elegir archivo) */
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

/** Tamaño máximo de una imagen insertada desde archivo o portapapeles */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedImageFile(file: File): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_IMAGE_BYTES;
}

/** Lee un fichero de imagen permitido como data URL; null si no es válido o falla la lectura */
export function readImageFile(file: File): Promise<string | null> {
  if (!isAllowedImageFile(file)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
