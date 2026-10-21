export interface StoredImage {
  uuid: string;
  name: string;
  description: string;
  scale: number;
  scaleUnit: string;
  dataUrl: string;
  type: string;
  width: number;
  height: number;
}

const maximumSide = 1200;

export function scaleBarMm(pxPerMm: number, imageWidthPx: number, shownWidthPx: number): number {
  if (!(pxPerMm > 0) || !(imageWidthPx > 0) || !(shownWidthPx > 0)) return 0;
  const shownPxPerMm = pxPerMm * shownWidthPx / imageWidthPx;
  const target = 0.2 * shownWidthPx / shownPxPerMm;
  const decade = 10 ** Math.floor(Math.log10(target));
  let best = decade;
  for (const multiplier of [1, 2, 5, 10]) if (Math.abs(multiplier * decade - target) < Math.abs(best - target)) best = multiplier * decade;
  return best;
}

function blobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Cannot encode the photo")), { once: true });
    reader.readAsDataURL(blob);
  });
}

export async function preparePhoto(file: File, pxPerMm: number): Promise<StoredImage> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error(`${file.name} is not a picture this program can read.`); }
  const originalWidth = bitmap.width, originalHeight = bitmap.height;
  const ratio = Math.min(1, maximumSide / Math.max(originalWidth, originalHeight));
  const width = Math.max(1, Math.round(originalWidth * ratio)), height = Math.max(1, Math.round(originalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("The browser cannot prepare this photo."); }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The photo could not be converted to JPEG.")), "image/jpeg", 0.88));
  const scale = pxPerMm > 0 ? pxPerMm * width / originalWidth : 0;
  return {
    uuid: crypto.randomUUID().replaceAll("-", ""), name: file.name, description: "", scale,
    scaleUnit: scale > 0 ? "px/mm" : "", dataUrl: await blobAsDataUrl(blob), type: "jpg", width, height
  };
}
