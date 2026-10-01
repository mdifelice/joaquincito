/*
 * tools/preview-sprites.js — DEV ONLY, not loaded by the browser.
 *
 * Renders the ASCII sprite grids from src/core/sprites.js as coloured blocks in
 * the terminal, so character art can be reviewed without launching a browser.
 *
 *   node tools/preview-sprites.js           # all sprites
 *   node tools/preview-sprites.js player    # only names containing "player"
 *
 * It loads the real source files in a VM sandbox with tiny DOM stubs, so what
 * you see here is exactly what ships.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

const sandbox = {
  window: {},
  Phaser: { GameObjects: { RetroFont: { Parse: () => ({}) } } },
  document: {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {}, translate() {}, scale() {} })
    })
  }
};
sandbox.window.Phaser = sandbox.Phaser;
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);

for (const file of ['src/core/pixel.js', 'src/core/font.js', 'src/core/sprites.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

const GRIDS = sandbox.window.JA.sprites.GRIDS;
const filter = process.argv[2] || '';

/*
 * Truecolor background blocks. A dim slab marks transparent pixels so the
 * sprite's bounding box is visible against the terminal background.
 */
function swatch(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `\x1b[48;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m  \x1b[0m`;
}
const BLANK = '\x1b[48;2;34;34;42m  \x1b[0m';

const names = Object.keys(GRIDS).filter((n) => n.toLowerCase().includes(filter.toLowerCase()));

for (const name of names) {
  const { rows, legend } = GRIDS[name];
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);

  // Lint: ragged rows and characters missing from the legend are silent
  // transparency bugs in the browser, so surface them here.
  const ragged = rows.filter((r) => r.length !== w).length;
  const unknown = new Set();
  for (const row of rows) {
    for (const ch of row) {
      if (ch !== '.' && !legend[ch]) unknown.add(ch);
    }
  }

  let header = `\n\x1b[1m${name}\x1b[0m  ${w}x${rows.length}`;
  if (ragged) header += `  \x1b[33m${ragged} ragged row(s)\x1b[0m`;
  if (unknown.size) header += `  \x1b[31munknown chars: ${[...unknown].join(' ')}\x1b[0m`;
  console.log(header);

  for (const row of rows) {
    let out = '';
    for (let i = 0; i < w; i++) {
      const ch = row[i] || '.';
      out += (ch === '.' || !legend[ch]) ? BLANK : swatch(legend[ch]);
    }
    console.log(out);
  }
}

console.log(`\n${names.length} sprite(s) shown.`);
