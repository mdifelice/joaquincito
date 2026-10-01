/*
 * tools/fix-levels.js — DEV ONLY.
 *
 * Pads every row in every level to a uniform width so the ASCII lines up.
 * Hand-typed ASCII levels always end up a character or two short somewhere, and
 * a short row in a terrain row would leave a hole in the ground.
 *
 * Each row is padded with its own dominant character, so a ground row stays
 * ground ('='), a water row stays water ('~'), and an empty row stays empty.
 * Run tools/lint-levels.js afterwards to see what is left.
 *
 *   node tools/fix-levels.js          # rewrite src/data/levels.js
 *   node tools/fix-levels.js --check  # report only, change nothing
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'src/data/levels.js');
const checkOnly = process.argv.includes('--check');

const source = fs.readFileSync(file, 'utf8');
const lines = source.split('\n');

/**
 * The character to pad a row with.
 *
 * Only a real terrain fill ('=', '-', '~') may pad a row, and only when it
 * dominates the row. Padding a mostly-empty row with whatever rare tile happens
 * to be in it would smear that tile across the whole level, so rows that are
 * mostly empty pad with '.' instead.
 */
function dominant(row) {
  const TERRAIN = new Set(['=', '-', '~']);
  const counts = new Map();
  for (const ch of row) {
    if (ch === '.') continue;
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }

  let best = '.';
  let bestCount = 0;
  for (const [ch, n] of counts) {
    if (n > bestCount) { best = ch; bestCount = n; }
  }

  const qualifies = TERRAIN.has(best) &&
    bestCount >= 5 &&
    bestCount >= row.length * 0.25;

  return qualifies ? best : '.';
}

// Find each `rows: [` ... `],` block and the row string literals inside it.
const blocks = [];
let inBlock = false;
let start = -1;

for (let i = 0; i < lines.length; i++) {
  if (!inBlock && /^\s*rows:\s*\[\s*$/.test(lines[i])) {
    inBlock = true;
    start = i;
  } else if (inBlock && /^\s*\],?\s*$/.test(lines[i])) {
    blocks.push({ start, end: i });
    inBlock = false;
  }
}

if (blocks.length === 0) {
  console.error('Could not find any `rows: [` blocks. Has the level format changed?');
  process.exit(1);
}

let changed = 0;

for (const block of blocks) {
  const rowLines = [];
  for (let i = block.start + 1; i < block.end; i++) {
    const m = /^(\s*)'([^']*)'(,?)\s*$/.exec(lines[i]);
    if (m) rowLines.push({ index: i, indent: m[1], text: m[2], comma: m[3] });
  }

  const width = Math.max(...rowLines.map((r) => r.text.length));

  for (const row of rowLines) {
    if (row.text.length === width) continue;
    changed++;
    const pad = dominant(row.text);
    const fixed = row.text + pad.repeat(width - row.text.length);
    console.log(
      `  row ${row.index} (level block at line ${block.start + 1}): ` +
      `${row.text.length} -> ${width}, padded with '${pad}'`
    );
    if (!checkOnly) {
      lines[row.index] = `${row.indent}'${fixed}'${row.comma}`;
    }
  }
}

if (checkOnly) {
  console.log(`\n${changed} row(s) need padding. Re-run without --check to fix.`);
  process.exit(changed === 0 ? 0 : 1);
}

fs.writeFileSync(file, lines.join('\n'));
console.log(`\nPadded ${changed} row(s) across ${blocks.length} level(s).`);
