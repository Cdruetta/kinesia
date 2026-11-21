const zlib = require('zlib');
const fs = require('fs');

function createPNG(width, height, drawFn) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Build raw image data with filter byte (0 = None) per scanline
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 3);
    rawData[rowOffset] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 3;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // Helper to create a chunk
  function createChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);
    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
  }

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Draw function for the icon: violet background with white paw print
function drawIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const scale = w / 192;

  // Background: violet #7051A6
  let r = 0x70, g = 0x51, b = 0xA6;

  // Rounded corners: if outside rounded rect, make transparent (white for simplicity, but PNG has no alpha)
  // Actually, for PWA icons, a solid background is fine. No rounded corners needed (the OS handles it).

  // Draw paw print in white
  // Main pad (ellipse at center)
  const mainPadCx = cx;
  const mainPadCy = cy + 10 * scale;
  const mainPadRx = 22 * scale;
  const mainPadRy = 28 * scale;
  if (((x - mainPadCx) / mainPadRx) ** 2 + ((y - mainPadCy) / mainPadRy) ** 2 <= 1) {
    r = 255; g = 255; b = 255;
  }

  // Toe pads (circles)
  const toes = [
    { cx: cx, cy: cy - 26 * scale, r: 18 * scale },
    { cx: cx - 36 * scale, cy: cy - 6 * scale, r: 14 * scale },
    { cx: cx + 36 * scale, cy: cy - 6 * scale, r: 14 * scale },
    { cx: cx - 21 * scale, cy: cy + 26 * scale, r: 12 * scale },
    { cx: cx + 21 * scale, cy: cy + 26 * scale, r: 12 * scale },
  ];
  for (const toe of toes) {
    const dx = x - toe.cx;
    const dy = y - toe.cy;
    if (dx * dx + dy * dy <= toe.r * toe.r) {
      r = 255; g = 255; b = 255;
    }
  }

  return [r, g, b];
}

// Generate 192x192
const png192 = createPNG(192, 192, drawIcon);
fs.writeFileSync('public/pwa-192x192.png', png192);
console.log('Generated public/pwa-192x192.png');

// Generate 512x512
const png512 = createPNG(512, 512, drawIcon);
fs.writeFileSync('public/pwa-512x512.png', png512);
console.log('Generated public/pwa-512x512.png');
