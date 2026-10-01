/*
 * make-favicon.js — write favicon.png, a 32x32 portrait of Joaquincito.
 *
 * Why a generated PNG rather than an SVG data URI? A favicon is the one piece
 * of art the browser asks for *before* any script has run, so it cannot come
 * from the canvas drawing the game itself. It also has to be a real raster
 * image: SVG favicons are not supported everywhere (Safari on iOS, for one).
 *
 * So this script encodes a PNG by hand. Node's zlib does the compression and
 * that is the only hard part; a PNG is just signature + IHDR + IDAT + IEND,
 * each chunk wrapped in a length and a CRC32. No image library needed, which
 * keeps the project installable with no dependencies at all.
 *
 * The art comes straight from the sprite grid in src/core/sprites.js, so the
 * favicon can never drift out of sync with the character in the game.
 *
 *   node tools/make-favicon.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

/* ------------------------------------------------------------------ */
/* Minimal PNG writer                                                  */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  // The CRC covers the type and the data, but not the length.
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/**
 * Encode an RGBA pixel buffer as a PNG.
 * @param {number} w
 * @param {number} h
 * @param {Buffer} rgba  w*h*4 bytes
 */
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bits per channel
  ihdr[9] = 6;  // colour type 6 = truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Every scanline is prefixed with its filter type. Filter 0 (none) keeps the
  // encoder trivial; the file is tiny anyway.
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ------------------------------------------------------------------ */
/* The portrait                                                         */
/* ------------------------------------------------------------------ */

// Pull the real sprite out of the game so the two can never disagree.
function loadPlayerSprite() {
  global.window = { JA: {} };
  global.Phaser = {};
  const file = path.join(ROOT, 'src/core/sprites.js');
  // The file is a browser script, so evaluate it and read the grid it exports.
  new Function('window', 'Phaser', fs.readFileSync(file, 'utf8'))(
    global.window,
    global.Phaser
  );
  const grids = global.window.JA.sprites.GRIDS;
  const sprite = grids.playerIdle;
  if (!sprite) throw new Error('playerIdle grid not found in src/core/sprites.js');
  return sprite;
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error('bad colour: ' + hex);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const SIZE = 32;
const SCALE = 2;          // 12x16 sprite -> 24x32
const PAD_X = (SIZE - 12 * SCALE) / 2; // 4px either side
const PAD_Y = (SIZE - 16 * SCALE) / 2; // 0px

function main() {
  const { rows, legend } = loadPlayerSprite();
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;

  const rgba = Buffer.alloc(SIZE * SIZE * 4);

  // A soft sky-blue disc behind the character so the icon reads on both light
  // and dark browser chrome.
  const cx = SIZE / 2 - 0.5;
  const cy = SIZE / 2 - 0.5;
  const radius = SIZE / 2 - 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > radius) continue;                       // outside the disc: transparent
      const edge = Math.min(1, radius - d);           // 1px soft rim
      const i = (y * SIZE + x) * 4;
      rgba[i] = 0xa8; rgba[i + 1] = 0xdc; rgba[i + 2] = 0xf8;
      rgba[i + 3] = Math.round(255 * edge);
    }
  }

  let painted = 0;
  for (let ry = 0; ry < h; ry++) {
    const row = rows[ry];
    for (let rx = 0; rx < w; rx++) {
      const ch = row[rx];
      if (ch === '.' || ch === ' ') continue;          // transparent in the sprite
      const entry = legend[ch];
      if (!entry) continue;
      const [r, g, b] = hexToRgb(entry);
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          const px = PAD_X + rx * SCALE + sx;
          const py = PAD_Y + ry * SCALE + sy;
          if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;
          const i = (py * SIZE + px) * 4;
          rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
        }
      }
      painted++;
    }
  }

  if (painted === 0) throw new Error('sprite grid produced no pixels');

  const png = encodePng(SIZE, SIZE, rgba);
  const out = path.join(ROOT, 'favicon.png');
  fs.writeFileSync(out, png);
  console.log('favicon.png written: ' + SIZE + 'x' + SIZE + ', ' + png.length + ' bytes, ' + painted + ' sprite pixels');
}

main();
