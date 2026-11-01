import type { Upload } from "@fxbot/sdk/client";

// libfx's limit for one prompt.
export const maxFiles = 8;

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

function isText(bytes: ArrayBuffer) {
  try {
    return !new TextDecoder("utf-8", { fatal: true }).decode(bytes).includes("\0");
  } catch {
    return false;
  }
}

// A small PNG, JPEG, GIF, or WebP goes as it is. Anything bigger, or another type the browser can draw, such as
// HEIC on Safari, is scaled to fit 1600 pixels and sent as JPEG, well inside libfx's 3.75 MiB for one image.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= 1 << 20 && /^image\/(png|jpeg|gif|webp)$/.test(file.type)) return file;
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
}

// An image or a UTF-8 text file, ready to send. An image's `url` is a data URL for its thumbnail.
export async function readFile(file: File): Promise<Upload> {
  let blob: Blob = file;
  if (file.type.startsWith("image/")) blob = await shrink(file).catch(() => Promise.reject(new Error(`Cannot read ${file.name}.`)));
  else if (!isText(await file.arrayBuffer())) throw new Error(`${file.name} is not an image or a text file.`);
  const url = await dataUrl(blob);
  const data = url.slice(url.indexOf(",") + 1);
  return blob.type.startsWith("image/") ? { name: file.name, type: blob.type, url, data } : { name: file.name, type: file.type || "text/plain", data };
}
