// Generates PWA icons (PNG) without external image dependencies.
// Output: public/icons/{icon,maskable}-{192,512}.png + apple-touch-icon.png
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icons",
);

// ---------- minimal PNG encoder (RGBA, 8-bit, filter 0) ----------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(
      raw,
      y * (width * 4 + 1) + 1,
      y * width * 4,
      (y + 1) * width * 4,
    );
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- balloon artwork ----------
const PINK = [236, 72, 153]; // bg badge
const WHITE = [255, 255, 255]; // balloon / knot / string
const PINK_LIGHT = [249, 168, 212]; // balloon highlight

function inEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inRoundedRect(px, py, w, h, r) {
  const x0 = Math.min(Math.max(px, r), w - r);
  const y0 = Math.min(Math.max(py, r), h - r);
  const dx = px - x0;
  const dy = py - y0;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, a, b, c) {
  const s1 = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  const s2 = (c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0]);
  const s3 = (a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0]);
  const hasNeg = s1 < 0 || s2 < 0 || s3 < 0;
  const hasPos = s1 > 0 || s2 > 0 || s3 > 0;
  return !(hasNeg && hasPos);
}

function sample(px, py, size, maskable) {
  const cx = size / 2;
  const cy = size * (maskable ? 0.46 : 0.44);
  const rx = size * (maskable ? 0.14 : 0.19);
  const ry = size * (maskable ? 0.17 : 0.23);

  // badge background
  if (!maskable && !inRoundedRect(px, py, size, size, size * 0.22)) {
    return [0, 0, 0, 0];
  }

  // string: gentle wave from below the knot
  const stringTop = cy + ry + size * (maskable ? 0.04 : 0.05);
  const stringBottom = size * (maskable ? 0.74 : 0.9);
  if (py >= stringTop && py <= stringBottom) {
    const t = (py - stringTop) / (stringBottom - stringTop);
    const waveX = cx + Math.sin(t * Math.PI * 2.5) * size * 0.02;
    const half = Math.max(size * 0.009, 0.8);
    if (Math.abs(px - waveX) <= half) return [...WHITE, 255];
  }

  // knot triangle under the balloon
  const knotY = cy + ry - size * 0.004;
  const knotBaseY = knotY + size * (maskable ? 0.035 : 0.05);
  if (
    inTriangle(
      px,
      py,
      [cx, knotY],
      [cx - rx * 0.26, knotBaseY],
      [cx + rx * 0.26, knotBaseY],
    )
  ) {
    return [...WHITE, 255];
  }

  // balloon body + highlight
  if (inEllipse(px, py, cx, cy, rx, ry)) {
    if (
      inEllipse(
        px,
        py,
        cx - rx * 0.38,
        cy - ry * 0.4,
        rx * 0.24,
        ry * 0.3,
      )
    ) {
      return [...PINK_LIGHT, 255];
    }
    return [...WHITE, 255];
  }

  return [...PINK, 255];
}

function render(size, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const sub = [0.25, 0.75]; // 2x2 supersampling for smooth edges
  const samples = sub.length * sub.length;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (const dy of sub) {
        for (const dx of sub) {
          const [sr, sg, sb, sa] = sample(x + dx, y + dy, size, maskable);
          r += sr * sa;
          g += sg * sa;
          b += sb * sa;
          a += sa;
        }
      }
      const idx = (y * size + x) * 4;
      if (a > 0) {
        // straight (non-premultiplied) color = weighted sum / total weight
        rgba[idx] = Math.round(r / a);
        rgba[idx + 1] = Math.round(g / a);
        rgba[idx + 2] = Math.round(b / a);
      }
      rgba[idx + 3] = Math.round(a / samples);
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });

const outputs = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "maskable-192.png", size: 192, maskable: true },
  { file: "maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
];

for (const { file, size, maskable } of outputs) {
  const png = render(size, maskable);
  writeFileSync(join(outDir, file), png);
  console.log(`wrote ${file} (${png.length} bytes)`);
}
