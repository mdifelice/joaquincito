/*
 * tools/lint-levels.js — DEV ONLY, not loaded by the browser.
 *
 * Levels are authored as hand-typed ASCII, where a single missing character
 * silently shifts a whole row. This checks the things that are easy to get
 * wrong and annoying to debug in the browser:
 *
 *   - every row in a level is the same width
 *   - only known tile characters are used
 *   - nothing from the old coin / platform / brick / enemy vocabulary has
 *     crept back in
 *   - exactly one player start and one school
 *   - the player start and school sit on solid ground
 *   - every cuadra has a checkpoint
 *   - the school is near the right edge
 *   - the school is actually REACHABLE, simulated with the same jump
 *     envelope the player has in game
 *
 *   node tools/lint-levels.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'src/data/levels.js'), 'utf8'), sandbox, {
  filename: 'src/data/levels.js'
});

const { list } = sandbox.window.JA.levels;

/* Things that are gone and must not come back: the old block vocabulary of
 * spikes, water and bricks, plus coins and one-way platforms. A level author
 * who copies an old level gets told rather than wondering why a row is not
 * doing what they expect. */
const REMOVED = {
  '^': 'spikes',
  '~': 'water',
  b: 'brick',
  c: 'coin',
  o: 'one-way platform',
  '?': 'question block'
};

/* The whole current vocabulary. `TC` are the solid obstacles (tree, parked
 * car), `prd` the crowd, `F` the boss, `fi` the power flowers. */
const KNOWN = new Set('.-=#PSKhfiprdFTCuLYG '.split(''));

/* How far the player's arc can carry them, in tiles, when they need to finish
 * `rise` tiles higher than they took off. The arc is y = 3.333dx - 0.5dx^2, so
 * a landing at net rise y is reachable anywhere up to the descending branch. */
function reachAtRise(rise) {
  const disc = 11.11 - 2 * rise;
  if (disc < 0) return 0; // higher than the apex of a full jump
  return 3.333 + Math.sqrt(disc);
}

/* The player's jump. These were measured in the browser against the real
 * physics body: a held jump from a full run rises 5.35 tiles and carries 6.43
 * tiles across, while a tapped jump is a short ~1.5-tile hop. The two numbers
 * are NOT independent -- the horizontal reach and the height gained are the two
 * halves of one parabola, so a jump cannot be 6 tiles across *and* 4 tiles up.
 *
 * Modelling that as a rectangle (6 across by 5 up) lets a level ask for a jump
 * that cannot be made, so the reach is a function of the height instead. With
 * the constants below, at a running speed of 120px/s:
 *
 *     across:  1     2     3     4     5     6    6.7
 *     rise:  2.8   4.7   5.5   5.3   4.2   2.0   0.0   tiles
 *
 * Everything is rounded down with a 5% margin so a level only ever has to clear
 * what the player can definitely manage. */
const TILE = 16;
const JUMP_VX = 120;   // px/s, top running speed
const JUMP_V0 = 400;   // px/s, launch speed (GameScene JUMP)
const GRAVITY = 900;   // px/s^2

const JUMP_UP = 5;     // straight-up rise, the peak of the curve
const JUMP_ACROSS = 6; // flat gap the player can still clear

/** Highest the arc can still be, `dx` tiles from the takeoff. */
function maxRiseAt(dx) {
  if (dx <= 0) return JUMP_UP;
  const t = (dx * TILE) / JUMP_VX;
  const rise = (JUMP_V0 * t - 0.5 * GRAVITY * t * t) / TILE;
  return Math.max(0, Math.floor(rise * 0.95));
}

let problems = 0;
const fail = (msg) => { problems++; console.log(`  \x1b[31mx\x1b[0m ${msg}`); };

// Filled in per level; printed as JSON at the end when `--route` is passed.
const routes = {};

for (const level of list) {
  console.log(`\n\x1b[1m${level.id}. ${level.name}\x1b[0m  (${level.theme})`);
  const rows = level.rows;
  const H = rows.length;
  const width = Math.max(...rows.map((r) => r.length));

  // Row width
  rows.forEach((r, y) => {
    if (r.length !== width) {
      fail(`row ${y} is ${r.length} wide, expected ${width}`);
    }
  });

  // Unknown characters
  const unknown = new Set();
  const removed = new Set();
  for (const r of rows) {
    for (const ch of r) {
      if (REMOVED[ch]) removed.add(ch);
      else if (!KNOWN.has(ch)) unknown.add(ch);
    }
  }
  if (unknown.size) {
    fail(`unknown tile character(s): ${[...unknown].map((c) => JSON.stringify(c)).join(' ')}`);
  }
  if (removed.size) {
    fail(
      `removed content still present: ` +
      [...removed].map((c) => `'${c}' (${REMOVED[c]})`).join(', ')
    );
  }

  const count = (ch) => rows.join('').split(ch).length - 1;
  const idx = (ch) => {
    for (let y = 0; y < H; y++) {
      const x = rows[y].indexOf(ch);
      if (x !== -1) return { x, y };
    }
    return null;
  };
  const at = (x, y) => (y >= 0 && y < H && x >= 0 && x < width ? rows[y][x] : '.');
  const solid = (x, y) => '#=-'.includes(at(x, y));
  // Trees and parked cars are solid. They are NOT terrain, though: each one
  // occupies a single tile and can be jumped over or stood on top of, so the
  // reachability solver treats them as obstacles to climb rather than walls.
  const obstacle = (x, y) => 'TC'.includes(at(x, y));
  // Markers (P S K h f i), the crowd (p r d) and decor (u L Y G) are drawn *in*
  // tiles the player walks through, so they must not read as walls.
  const blocked = (x, y) => solid(x, y) || obstacle(x, y);

  if (count('P') !== 1) fail(`expected exactly 1 player start 'P', found ${count('P')}`);
  if (count('S') !== 1) fail(`expected exactly 1 finish line 'S', found ${count('S')}`);
  if (count('K') === 0) fail('no checkpoint flag "K"');
  if (count('T') + count('C') === 0) fail('no solid obstacles (tree or parked car)');
  if (count('p') + count('r') + count('d') === 0) fail('no enemies');
  if (count('L') + count('Y') + count('G') + count('u') === 0) fail('no street decoration');

  // The last cuadra is the only one without a power flower to collect: by then
  // the player has met both, and both are needed to get through the crowd.
  if (level.id < 5 && count('f') + count('i') === 0) {
    fail('no power flower "f" or "i" in this cuadra');
  }

  // Start and finish must be standing on something solid, in clear air.
  for (const [label, ch] of [['start', 'P'], ['finish', 'S']]) {
    const p = idx(ch);
    if (!p) continue;
    if (!solid(p.x, p.y + 1)) {
      fail(`${label} at (${p.x},${p.y}) has '${at(p.x, p.y + 1)}' below it, not solid road`);
    }
    if (p.y > 0 && blocked(p.x, p.y - 1)) {
      fail(`${label} at (${p.x},${p.y}) is walled in by '${at(p.x, p.y - 1)}' above`);
    }
  }

  // Enemies are placed in the open, never inside a wall, and they need solid
  // road under them or they would be standing in mid-air. Felipe is checked the
  // same way, so he cannot be dropped into a pit.
  for (const kind of ['p', 'r', 'd', 'F']) {
    for (let y = 0; y < H; y++) {
      const x = rows[y].indexOf(kind);
      if (x === -1) continue;
      if (!solid(x, y + 1)) {
        fail(`enemy '${kind}' at (${x},${y}) is not standing on solid road`);
      }
      if (blocked(x, y)) {
        fail(`enemy '${kind}' at (${x},${y}) is inside a blocked tile`);
      }
    }
  }

  /* ---- Reachability -------------------------------------------------- */
  // A tile is standable when the player can rest on it: something solid
  // underneath, and the tile itself free. A tree or a car counts as solid
  // underneath, because in game it is a solid body the player can land on top
  // of — which is exactly how a parked car is meant to be dealt with.
  const standable = (x, y) => (solid(x, y + 1) || obstacle(x, y + 1)) && !blocked(x, y);

  // A jump is modelled as an arc: rise in the current column to an apex, cross
  // horizontally at the apex, then drop onto the landing tile. The apex is not
  // fixed — the player can cross over something at their own height by rising
  // first, so every apex between the takeoff and the full jump height is tried.
  // Requiring all three corridors to be clear at one of them is conservative:
  // if it passes, the real jump only has an easier time.
  //
  // The landing may be *lower* than the takeoff, which is what stepping off a
  // ledge is, so an apex at the takeoff height is allowed.
  function canJump(fromX, fromY, toX, toY) {
    const dx = Math.abs(toX - fromX);
    if (dx > JUMP_ACROSS) return false;
    if (fromY - toY > JUMP_UP) return false;

    // The apex is bounded by the arc, so a long jump cannot also climb high.
    const apexRoom = maxRiseAt(dx);
    if (apexRoom <= 0) return false;

    // The apex can never be below either end. Smaller row index = higher up.
    const lowest = Math.min(fromY, toY);
    for (let apex = lowest; apex >= fromY - apexRoom; apex--) {
      let clear = true;

      // Rise in the source column.
      for (let y = apex; y <= fromY; y++) {
        if (blocked(fromX, y)) { clear = false; break; }
      }
      if (!clear) continue;

      // Cross at the apex.
      const step = toX < fromX ? -1 : 1;
      for (let x = fromX; x !== toX; x += step) {
        if (blocked(x, apex)) { clear = false; break; }
      }
      if (!clear) continue;

      // Drop onto the landing tile.
      for (let y = toY; y <= apex; y++) {
        if (blocked(toX, y)) { clear = false; break; }
      }
      if (clear) return true;
    }
    return false;
  }

  /* The route a well-played run would take: the path whose *worst* jump has the
   * most slack. BFS alone reports whatever path it happened to find, and since
   * it tries the longest steps first that path is full of jumps nobody would
   * actually make. This is a max-min ("widest path") search instead, so the
   * slack it reports is the most forgiving way through the level -- if even
   * this is tight, the level really is tight. */
  function widestRoute(from) {
    const best = new Map();               // node key -> best (largest) min-slack
    const prev = new Map();
    best.set(from.x + ',' + from.y, Infinity);
    const open = [from];

    while (open.length) {
      // Pick the node with the most slack so far; O(n^2) is fine at this size.
      let bi = 0;
      for (let i = 1; i < open.length; i++) {
        if (best.get(open[i].x + ',' + open[i].y) > best.get(open[bi].x + ',' + open[bi].y)) bi = i;
      }
      const node = open.splice(bi, 1)[0];
      const here = best.get(node.x + ',' + node.y);

      for (let dy = -JUMP_UP; dy <= H; dy++) {
        for (let dx = -JUMP_ACROSS; dx <= JUMP_ACROSS; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tx = node.x + dx, ty = node.y + dy;
          if (tx < 0 || tx >= width) continue;
          if (!standable(tx, ty)) continue;
          if (!canJump(node.x, node.y, tx, ty)) continue;

          const slack = reachAtRise(node.y - ty) - dx;
          const key = tx + ',' + ty;
          const via = Math.min(here, slack);
          if (via > (best.has(key) ? best.get(key) : -Infinity)) {
            best.set(key, via);
            prev.set(key, node);
            if (!open.some((n) => n.x === tx && n.y === ty)) open.push({ x: tx, y: ty });
          }
        }
      }
    }
    return { best, prev };
  }

  const spawn = idx('P');
  const seen = new Set();
  const cameFrom = new Map();
  const queue = [];
  if (spawn && standable(spawn.x, spawn.y)) {
    queue.push(spawn);
    seen.add(spawn.x + ',' + spawn.y);
  } else {
    fail(`start at (${spawn ? spawn.x : '?'},${spawn ? spawn.y : '?'}) is not a tile the player can stand on`);
  }

  while (queue.length) {
    const node = queue.shift();
    for (let dy = -JUMP_UP; dy <= H; dy++) {
      for (let dx = -JUMP_ACROSS; dx <= JUMP_ACROSS; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = node.x + dx;
        const ty = node.y + dy;
        if (tx < 0 || tx >= width) continue;
        if (!standable(tx, ty)) continue;
        if (!canJump(node.x, node.y, tx, ty)) continue;
        const key = tx + ',' + ty;
        if (seen.has(key)) continue;
        seen.add(key);
        cameFrom.set(key, node);
        queue.push({ x: tx, y: ty });
      }
    }
  }

  // `--route` prints the walk the search found, so the level can be driven in a
  // real browser and checked against the physics rather than only this model.

  const goal = idx('S');
  if (goal) {
    const goalKey = goal.x + ',' + goal.y;
    const onGoal = seen.has(goalKey) || seen.has(goal.x + ',' + (goal.y - 1));
    if (!onGoal) {
      fail(
        `school at (${goal.x},${goal.y}) cannot be reached — only ${seen.size} tile(s) ` +
        `of the level are standable and connected`
      );
    }
    if (goal.x < width - 4) {
      fail(`school at x=${goal.x} is not near the right edge (width ${width})`);
    }
    if (onGoal) {
      const end = seen.has(goalKey) ? { x: goal.x, y: goal.y } : { x: goal.x, y: goal.y - 1 };
      const endKey = end.x + ',' + end.y;

      // Walk the widest path back, then report its worst hop.
      const { best, prev } = widestRoute(spawn);
      const path = [];
      let cur = end;
      while (cur) {
        path.push({ x: cur.x, y: cur.y });
        cur = prev.get(cur.x + ',' + cur.y);
      }
      path.reverse();

      const minSlack = best.get(endKey);
      const worst = path
        .slice(1)
        .map((b, i) => {
          const a = path[i];
          return {
            from: a, to: b, dx: Math.abs(b.x - a.x), rise: a.y - b.y,
            slack: +(reachAtRise(a.y - b.y) - Math.abs(b.x - a.x)).toFixed(2)
          };
        })
        .reduce((w, h) => (h.slack < w.slack ? h : w), { slack: Infinity, dx: 0, rise: 0, from: end, to: end });

      routes[level.name] = { path, minSlack: +(minSlack ?? 0).toFixed(2), worst };
    }
  }

  /* ---- Comfort checks -------------------------------------------------- */
  // Nothing may be taller than the player can jump onto in one go.
  for (let x = 0; x < width; x++) {
    let top = H;
    for (let y = 0; y < H; y++) {
      if (at(x, y) === '#') top = y;
    }
    if (top < H) {
      const base = (() => { for (let y = H - 1; y >= 0; y--) if (solid(x, y)) return y; return H; })();
      const rise = base - top;
      if (rise > JUMP_UP) fail(`solid column x=${x} is ${rise} tiles tall (max ${JUMP_UP})`);
    }
  }

  // A gap in the road wider than the jump is a dead end. Gaps are measured on
  // the ground row: a run of missing tiles there is the pit the player has to
  // clear, and anything wider than the jump cannot be cleared at all.
  const roadRow = (() => {
    for (let y = 0; y < H; y++) if (at(0, y) === '=') return y;
    return -1;
  })();

  if (roadRow === -1) fail('no road surface row: row 0 should start with "=" somewhere');

  if (roadRow >= 0) {
    for (const [label, y] of [['road', roadRow]]) {
      let run = 0;
      for (let x = 0; x <= width; x++) {
        if (at(x, y) === '.') run++;
        else {
          if (run > JUMP_ACROSS) fail(`gap on the ${label} at row ${y} is ${run} tiles wide (max ${JUMP_ACROSS})`);
          run = 0;
        }
      }
    }
  }

  const stats = {
    gaps: roadRow >= 0
      ? rows[roadRow].split('').filter((c) => c === '.').length
      : 0,
    blocks: count('#'),
    trees: count('T'),
    cars: count('C'),
    walkers: count('p'),
    cyclists: count('r'),
    dogs: count('d'),
    bosses: count('F'),
    fireFlowers: count('f'),
    iceFlowers: count('i'),
    checkpoints: count('K'),
    hearts: count('h'),
    decor: count('u') + count('L') + count('Y') + count('G')
  };

  console.log(
    `  ${width}x${H} tiles | gap tiles ${stats.gaps} | blocks ${stats.blocks} | ` +
    `trees ${stats.trees} | cars ${stats.cars} | ` +
    `people ${stats.walkers} + bikes ${stats.cyclists} + dogs ${stats.dogs} + bosses ${stats.bosses} | ` +
    `flowers ${stats.fireFlowers}F ${stats.iceFlowers}I | ` +
    `checkpoints ${stats.checkpoints} | hearts ${stats.hearts} | decor ${stats.decor} | ` +
    `standable ${seen.size}`
  );
}

const wantRoute = process.argv.includes('--route');

console.log(
  problems === 0
    ? `\n\x1b[32mAll ${list.length} cuadras look consistent and are beatable.\x1b[0m`
    : `\n\x1b[31m${problems} problem(s) found.\x1b[0m`
);

if (wantRoute) {
  // Pure JSON on the last line so a test can read it without parsing prose.
  console.log(JSON.stringify(routes));
}

process.exit(problems === 0 ? 0 : 1);
