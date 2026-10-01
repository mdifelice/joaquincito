/*
 * tools/preview-font.js — DEV ONLY, not loaded by the browser.
 *
 * Renders the generated pixel font as ASCII in the terminal so glyph shapes can
 * be eyeballed without launching a browser.
 *
 *   node tools/preview-font.js
 *
 * It loads the real src/core/font.js in a VM sandbox with tiny DOM stubs and
 * reads the glyph table back out, so what you see is exactly what ships.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function stubContext() {
  return {
    fillStyle: '#000',
    imageSmoothingEnabled: true,
    fillRect() {}, drawImage() {}, translate() {}, scale() {}
  };
}

const sandbox = {
  window: {},
  Phaser: { GameObjects: { RetroFont: { Parse: () => ({}) } } },
  document: {
    createElement: () => ({ width: 0, height: 0, getContext: stubContext })
  }
};
sandbox.window.Phaser = sandbox.Phaser;
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);

for (const file of ['src/core/pixel.js', 'src/core/font.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

const font = sandbox.window.JA.font;
const { chars, glyphs, accented } = font;

function maskToRow(mask) {
  let out = '';
  for (let col = 0; col < font.cellW; col++) {
    out += (mask & (1 << (font.cellW - 1 - col))) ? '#' : '.';
  }
  return out;
}

function rowsFor(ch) {
  const rows = new Array(font.cellH).fill(0);
  if (accented[ch]) {
    rows[0] = accented[ch].accent;
    const base = glyphs[accented[ch].base];
    for (let r = 0; r < 7; r++) rows[r + 1] = base[r];
  } else {
    const g = glyphs[ch] || glyphs[ch.toUpperCase()];
    if (g) for (let r = 0; r < 7; r++) rows[r + 1] = g[r];
  }
  return rows;
}

const missing = [];
const perLine = 14;
for (let i = 0; i < chars.length; i += perLine) {
  const group = chars.slice(i, i + perLine).split('');
  const out = Array.from({ length: font.cellH }, () => []);

  for (const ch of group) {
    if (!glyphs[ch] && !glyphs[ch.toUpperCase()] && !accented[ch] && ch !== ' ') {
      missing.push(ch);
    }
    const rows = rowsFor(ch);
    for (let r = 0; r < font.cellH; r++) out[r].push(maskToRow(rows[r]));
  }

  console.log(out.map((l) => l.join(' ')).join('\n'));
  console.log(group.map((c) => (c === ' ' ? '·' : c)).join(' '));
  console.log('─'.repeat(group.length * (font.cellW + 1) - 1));
}

console.log(missing.length ? `MISSING GLYPHS: ${missing.join(' ')}` : 'All glyphs present.');
