const JPEG_QUALITY = 0.82;
const SKIP_COMPRESSION_BYTES = 300 * 1024;

/**
 * Shrink large photos before they leave the browser: downscale to
 * maxDimension on the long edge and re-encode as JPEG. Small files and
 * files the browser cannot decode are returned untouched.
 * (Extracted from ProductForm so other upload flows can reuse it.)
 */
export async function compressImage(
  file: File,
  maxDimension: number,
): Promise<File> {
  if (file.size <= SKIP_COMPRESSION_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // undecodable in this browser — upload the original
  }

  const scale = Math.min(
    1,
    maxDimension / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  // Flatten transparency onto white so JPEG output has no black background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}
