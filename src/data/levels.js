/*
 * levels.js — the five cuadras, and the legend that describes them.
 *
 * ============================================================================
 * HOW TO EDIT A CUADRA
 * ============================================================================
 * Each level is a list of strings, one per row of tiles, drawn top to bottom.
 * A tile is 16x16 pixels. Every row in a level must be the SAME length — the
 * linter (tools/lint-levels.js) checks this for you:
 *
 *     node tools/lint-levels.js
 *
 * The game is 400x240, which is 25x15 tiles, so a 15-row level never scrolls
 * vertically. That is deliberate: a six-year-old plays much better when only the
 * horizontal camera moves. Row 12 is the ground surface, leaving rows 0-11 as
 * headroom.
 *
 * TILE LEGEND — every cuadra is a street block
 *   .   empty space
 *   =   road surface                        (use for the topmost ground row)
 *   -   road, no cap                        (use for rows below the surface)
 *   #   solid block: a kerb, wall or step to climb
 *   T   tree        — solid obstacle, climb it
 *   C   parked car  — solid obstacle, taller than a tree
 *
 * THINGS (start, goal, pickups)
 *   P   player start
 *   S   the finish line — reaching it ends the cuadra
 *   K   checkpoint flag
 *   h   extra life
 *   f   fire flower   — lets you throw fire at enemies
 *   i   ice flower    — lets you throw ice and freeze enemies
 *
 * ENEMIES (alive, they walk; touching one costs a life)
 *   p   person walking
 *   r   person on a bike (faster)
 *   d   dog (low, quick to turn)
 *   F   Felipe — the last cuadra's bully. Bigger, jumps, and cannot be
 *       defeated by stomping: only fire or ice balls hurt him, three of them.
 *       He never blocks the way, so he can be dodged and left behind.
 *
 * DECORATION (drawn behind the player, no collision)
 *   u   bush     L   lamp post    Y   hydrant    G   litter bin
 *
 * Spikes, water, bricks, coins and one-way platforms are GONE. A street block is
 * made of solid things to climb and people to dodge, and the clock is the real
 * opponent. Those characters are not in the legend below, so the linter rejects
 * them if one sneaks back in.
 *
 * Note each tile is exactly ONE character, so the bush is 'u' and not 'B'.
 *
 * The level author only needs `rows` plus the metadata above it. Everything the
 * engine needs (tile layers, colliders, entity positions) is derived from
 * these rows at load time, so there is no second list to keep in sync.
 * ============================================================================
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  // Which characters are solid, and what each enemy is. Kept next to the legend
  // so the two can never drift apart.
  //
  // There is no "deadly" or "hurt" tile any more: the only ways to lose a life
  // are touching an enemy and falling off the bottom of the block. Both are
  // handled by GameScene rather than by the terrain.
  var SOLID = '#=-'.split('');
  var OBSTACLE = 'TC'.split('');

  // Enemies, and how they move. Speed is in pixels/second.
  var ENEMY_KINDS = {
    p: { sprite: 'walkerWalk', anim: 'walker-walk', speed: 16, w: 10, h: 15, label: 'person' },
    r: { sprite: 'cyclistWalk', anim: 'cyclist-walk', speed: 42, w: 18, h: 17, label: 'cyclist' },
    d: { sprite: 'dogWalk', anim: 'dog-walk', speed: 30, w: 14, h: 11, label: 'dog' }
  };

  // The boss is not part of the walking crowd: he has his own health, he jumps,
  // and only balls hurt him. He is kept out of ENEMY_KINDS so the ordinary enemy
  // code (stomp to defeat) never touches him.
  var BOSS_KIND = {
    sprite: 'boyIdle', anim: 'felipe-walk', speed: 22, w: 12, h: 20, hp: 3, label: 'Felipe'
  };

  // One minute a cuadra, five cuadras: the whole run has to fit inside 9:00-9:05.
  var RUN_MS = 5 * 60 * 1000;

  var LEVELS = [

  /* 1. DONADO — the gentlest block: one pit, a car to climb and a
   * couple of walkers. Enough to learn the controls, with slack in the clock
   * in case a six-year-old needs it. */
    {
      id: 1,
      name: 'DONADO',
      theme: 'calle',
      map: { x: 40, y: 180, label: 'DONADO' },
      rows: [
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '..........................................................................',
        '......................###.................................................',
        '.P................T...###..u.....C......L...........K..p..G..p...dh..Yf.S.',
        '============================================...===========================',
        '--------------------------------------------...---------------------------',
        '--------------------------------------------...---------------------------',
      ]
    },

  /* 2. HOLMBERG — the park. Two pits, more trees, and the first fire
   * flower so there is a way to deal with the crowd other than dodging it. */
    {
      id: 2,
      name: 'HOLMBERG',
      theme: 'parque',
      map: { x: 110, y: 180, label: 'HOLMBERG' },
      rows: [
        '........................................................................................',
        '........................................................................................',
        '........................................................................................',
        '........................................................................................',
        '........................................................................................',
        '........................................................................................',
        '........................................................................................',
        '........................................................................................',
        '........................................................................................',
        '..............................................................####......................',
        '....................####......................................####......................',
        '.P......T...u.......####...C.p.L..........K...d.....f...T.....####..p.....Y.p.K.C...G.S.',
        '==================================....================================....==============',
        '----------------------------------....--------------------------------....--------------',
        '----------------------------------....--------------------------------....--------------',
      ]
    },

  /* 3. PLAZA — the square. Cyclists appear, which are fast enough to reach a
   * gap before the player does, and the ice flower turns them still for long
   * enough to walk past. */
    {
      id: 3,
      name: 'PLAZA',
      theme: 'plaza',
      map: { x: 180, y: 180, label: 'PLAZA' },
      rows: [
        '......................................................................................................',
        '......................................................................................................',
        '......................................................................................................',
        '......................................................................................................',
        '......................................................................................................',
        '......................................................................................................',
        '......................................................................................................',
        '......................................................................................................',
        '......................................................................................................',
        '..................................................####................................................',
        '..................####............................####........................#####...................',
        '.P........T.......####..p..L........K...r....C....####d.........K...i...T..p..#####.......r...K..u.pS.',
        '==============================....========================....======================....==============',
        '------------------------------....------------------------....----------------------....--------------',
        '------------------------------....------------------------....----------------------....--------------',
      ]
    },

  /* 4. TRONADOR — the market street. Long, with parked cars to hop and
   * both flowers on the route. Checkpoints are never more than 20 tiles apart. */
    {
      id: 4,
      name: 'TRONADOR',
      theme: 'mercado',
      map: { x: 250, y: 180, label: 'TRONADOR' },
      rows: [
        '........................................................................................................................',
        '........................................................................................................................',
        '........................................................................................................................',
        '........................................................................................................................',
        '........................................................................................................................',
        '........................................................................................................................',
        '........................................................................................................................',
        '........................................................................................................................',
        '........................................................................................................................',
        '............................................................#####.......................................................',
        '....................####....................................#####.............................######....................',
        '.P.......T....G.....####..p........K..C...r...d...L.........#####.f...T...K...p.......i...C...######.r........KY.d..G.S.',
        '============================....====================....========================....====================....============',
        '----------------------------....--------------------....------------------------....--------------------....------------',
        '----------------------------....--------------------....------------------------....--------------------....------------',
      ]
    },

  /* 5. PALLOTI — the long way home, in the fading light. Every kind of
   * enemy, five pits, and the school at the end: the run has to be clean to
   * beat 9:05. */
    {
      id: 5,
      name: 'PALLOTI',
      theme: 'atardecer',
      map: { x: 320, y: 180, label: 'PALLOTI' },
      rows: [
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................................................................................................',
        '......................................................#####.................................................................#####.....',
        '................####..................................#####.................................#####...........................#####.....',
        '.P......T...p...####..d.........K...C...r...L.........#####.f...T...K...........i...p...C...#####.....r...d.F.K.p........Lh.#####.G.S.',
        '========================....==================.....=====================.....===================....================.....=============',
        '------------------------....------------------.....---------------------.....-------------------....----------------.....-------------',
        '------------------------....------------------.....---------------------.....-------------------....----------------.....-------------',
      ]
    }

  ];

  /**
   * Parse the ASCII rows into a form the engine can use directly.
   *
   * Returns:
   *   width, height      in tiles
   *   index(x, y)        -> char, or '.' outside the level
   *   isSolid            tile predicate (road, kerb, trees, cars)
   *   things             [{type, x, y, tx, ty}] for P S K h f i
   *   enemies            [{type, x, y, tx, ty, kind}] for p r d
   *   boss               the single F for this cuadra, or null
   *   decor              [{type, x, y}]
   */
  function parse(level) {
    var rows = level.rows;
    var height = rows.length;
    var width = 0;
    for (var i = 0; i < height; i++) {
      width = Math.max(width, rows[i].length);
    }

    function index(x, y) {
      if (y < 0 || y >= height || x < 0 || x >= width) return '.';
      var row = rows[y];
      return x < row.length ? row.charAt(x) : '.';
    }

    function inSet(set) {
      return function (ch) { return set.indexOf(ch) !== -1; };
    }

    var things = [];
    var decor = [];
    var enemies = [];
    var boss = null;

    var THING_KIND = {
      P: 'spawn', S: 'goal', K: 'checkpoint',
      h: 'heart', f: 'fireFlower', i: 'iceFlower'
    };
    var DECOR_KIND = { u: 'bush', L: 'lamp', Y: 'hydrant', G: 'bin' };

    for (var y = 0; y < height; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x);

        if (THING_KIND[ch]) {
          things.push({ type: THING_KIND[ch], x: x, y: y, tx: x, ty: y });
        } else if (ENEMY_KINDS[ch]) {
          // Enemies stand on the tile below them, so they are recorded with
          // their feet on the ground rather than their centre.
          enemies.push({
            kind: ch,
            type: 'enemy',
            x: x, y: y, tx: x, ty: y,
            spec: ENEMY_KINDS[ch]
          });
        } else if (ch === 'F') {
          // Only one Felipe per cuadra, so the last one wins if a typo adds two.
          boss = {
            kind: ch,
            type: 'boss',
            x: x, y: y, tx: x, ty: y,
            spec: BOSS_KIND
          };
        } else if (DECOR_KIND[ch]) {
          decor.push({ type: DECOR_KIND[ch], x: x, y: y });
        }
      }
    }

    // Fall back to a sane spawn/goal if the author forgot them, so a typo
    // makes a playable level rather than an unplayable one.
    var spawn = things.filter(function (t) { return t.type === 'spawn'; })[0];
    if (!spawn) {
      spawn = { type: 'spawn', x: 1, y: 11, tx: 1, ty: 11 };
      things.push(spawn);
    }
    var goal = things.filter(function (t) { return t.type === 'goal'; })[0];
    if (!goal) {
      goal = { type: 'goal', x: width - 2, y: 11, tx: width - 2, ty: 11 };
      things.push(goal);
    }

    return {
      width: width,
      height: height,
      index: index,
      isSolid: inSet(SOLID.concat(OBSTACLE)),
      isRoad: inSet(SOLID),
      isObstacle: inSet(OBSTACLE),
      things: things,
      enemies: enemies,
      boss: boss,
      decor: decor,
      spawn: spawn,
      goal: goal
    };
  }

  JA.levels = {
    list: LEVELS,
    count: LEVELS.length,
    runMs: RUN_MS,
    get: function (n) {
      return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, n - 1))];
    },
    parse: parse,
    SOLID: SOLID,
    OBSTACLE: OBSTACLE,
    ENEMY_KINDS: ENEMY_KINDS
  };
})(window.JA);
