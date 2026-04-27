const MAX_WIDTH = 800;
const JPEG_QUALITY = 0.8;

/**
 * Comprime um File de imagem para JPEG max 800px de largura, qualidade 80,
 * e retorna data URI base64. Mantem aspecto. Funciona em qualquer formato
 * de entrada que o browser saiba decodificar (jpg, png, webp, heic em iOS Safari).
 */
export async function compressImageToDataUri(file: File): Promise<string> {
  // Caminho rapido: se ja for jpeg < 800px e < 200KB, devolve direto
  // (evita re-compressao inutil)
  if (file.type === 'image/jpeg' && file.size < 200_000) {
    const meta = await readImageMeta(file);
    if (meta.width <= MAX_WIDTH) {
      return await fileToDataUri(file);
    }
  }

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_WIDTH / bitmap.width);
  const targetW = Math.round(bitmap.width * ratio);
  const targetH = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob retornou null'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  return await blobToDataUri(blob);
}

async function readImageMeta(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const out = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return out;
}

function fileToDataUri(file: File): Promise<string> {
  return blobToDataUri(file);
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}
