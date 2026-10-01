/*
 * sprites.js — character, enemy and item art, defined as ASCII grids.
 *
 * Every sprite is a `rows` array (one string per pixel row) plus a `legend`
 * mapping single characters to colours from palette.js. Drawing a character is
 * therefore just sketching it as text, which is far easier to tweak than
 * poking at canvas coordinates.
 *
 * The grids here are the *source of truth*; the texture-building step at the
 * bottom just rasterises them. `JA.sprites.GRIDS` is exposed so the Node
 * preview tool (tools/preview-sprites.js) can render them as ASCII for review.
 *
 * Convention: sprites are drawn facing RIGHT. Left-facing variants are made by
 * mirroring at texture-build time, so a sprite only ever needs one direction.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Shared legends                                                      */
  /* ------------------------------------------------------------------ */

  // Legend for Joaquincito.
  var PLAYER = {
    k: '#f0c090', // skin
    K: '#c88050', // skin shadow (mouth / chin)
    h: '#50301c', // hair
    c: '#e03828', // cap
    C: '#982018', // cap shadow / brim
    y: '#f8d038', // shirt
    Y: '#c89818', // shirt shadow
    b: '#3868c8', // denim overalls
    B: '#203c80', // denim shadow
    w: '#7a4520', // shoes
    W: '#4a2810', // shoe soles
    e: '#181828'  // eyes
  };

  // Legend for the pigeon enemy.
  var BIRD = {
    l: '#b8c4d8', // light body
    d: '#8894ac', // shaded body
    k: '#f0a020', // beak
    e: '#181828', // eye
    f: '#f0d040'  // feet
  };

  // Legend for the wasp enemy.
  var WASP = {
    y: '#f8d838',
    k: '#302820',
    b: '#4878e0',
    w: '#d8f0ff',
    e: '#181828'
  };

  // Legend for the runaway ball.
  var BALL = {
    b: '#4878e0',
    w: '#f0f0f8'
  };

  // Legend for Choco, the dog boss.
  var DOG = {
    l: '#d89850', // fur
    d: '#a06828', // fur shadow
    L: '#f0d0a0', // muzzle / belly
    e: '#181828', // eye + nose
    w: '#f8f8f8', // eye white / teeth
    m: '#a01828',  // mouth
    k: '#f0c090'   // tongue
  };

  // Legend for the grown-ups and children out on the street. Several of them
  // share one palette because they are all people: only the shirt and trousers
  // change, so a single legend keeps them visually related.
  var PERSON = {
    k: '#f0c090', // skin
    K: '#c88050', // skin shadow
    h: '#50301c', // hair
    H: '#30201c', // hair shadow
    w: '#f8f8f8', // shirt
    W: '#c8c8d0', // shirt shadow
    b: '#3868c8', // trousers
    B: '#203c80', // trousers shadow
    s: '#7a4520', // shoes
    e: '#181828',  // eye
    o: '#d83858',  // extra shirt colour (coat / dress)
    O: '#a01838'
  };

  // The cyclist shares the person palette; the bike gets its own letters.
  var CYCLIST = {
    k: '#f0c090',
    K: '#c88050',
    h: '#50301c',
    w: '#f8f8f8',
    W: '#c8c8d0',
    b: '#3868c8',
    s: '#7a4520',
    e: '#181828',
    o: '#d83858', // jacket
    O: '#a01838', // jacket shadow
    c: '#e04848', // bike frame
    C: '#982018', // frame shadow
    m: '#484848', // wheel hubs
    M: '#282828'  // tyres
  };

  // A street dog: smaller than Choco, grey, and not a boss.
  var STREETDOG = {
    l: '#b0a090', // fur
    d: '#786858', // fur shadow
    L: '#e8e0d0', // muzzle / belly
    e: '#181828', // eye + nose
    k: '#f0c090'  // tongue
  };

  // Projectiles. Fire and ice are deliberately the same shape so the thrown
  // thing reads as "the same power, different element".
  var FIREBALL = {
    y: '#f8d038',
    o: '#e84818',
    r: '#a02008',
    w: '#fff0b0'
  };

  var ICEBALL = {
    c: '#a0e0f8',
    b: '#58a8d8',
    d: '#2868a0',
    w: '#f0fbff'
  };

  // Powerup flowers, 12x12.
  var FIREFLOWER = {
    o: '#e84818', // petals
    r: '#a02008', // petal shadow
    y: '#f8d038', // centre
    k: '#387828', // stem
    K: '#205018'  // stem shadow
  };

  var ICEFLOWER = {
    c: '#a0e0f8', // petals
    b: '#58a8d8', // petal shadow
    w: '#f0fbff', // centre
    k: '#387828', // stem
    K: '#205018'  // stem shadow
  };

  /* ------------------------------------------------------------------ */
  /* Joaquincito — 12x16, side view facing right                        */
  /* ------------------------------------------------------------------ */

  var PLAYER_IDLE = [

    '...cccccc...',
    '..cccccccc..',
    '.hhccccccCCC',
    '.hcccccccCC.',
    '..kkkkkkkk..',
    '..kekeekek..',
    '..kkkkkkkk..',
    '...kKKKkk...',
    '..kyyyyyyk..',
    '..kyyyyyyk..',
    '..kybbbyk...',
    '..kybbbyk...',
    '..bbbbbbbb..',
    '...bbb.bbb..',
    '...www.www..',
    '...WWW.WWW..',
  ];

  var PLAYER_RUN_A = [

    '...cccccc...',
    '..cccccccc..',
    '.hhccccccCCC',
    '.hcccccccCC.',
    '..kkkkkkkk..',
    '..kekeekek..',
    '..kkkkkkkk..',
    '...kKKKkk...',
    '..kyyyyyyk..',
    '.kyyyyyyyk..',
    '.kybbbyyk...',
    '.kybbbyyk...',
    '..bbbbbbb...',
    '.bbbb.bbb...',
    '.www..wwww..',
    '.WWW..WWWW..',
  ];

  var PLAYER_RUN_B = [

    '...cccccc...',
    '..cccccccc..',
    '.hhccccccCCC',
    '.hcccccccCC.',
    '..kkkkkkkk..',
    '..kekeekek..',
    '..kkkkkkkk..',
    '...kKKKkk...',
    '..kyyyyyyk..',
    '..kyyyyyyk..',
    '..kybbbyk...',
    '..kybbbyk...',
    '..bbbbbbbb..',
    '..bbbbbbb...',
    '..wwwwwww...',
    '..WWWWWWW...',
  ];

  var PLAYER_RUN_C = [

    '...cccccc...',
    '..cccccccc..',
    '.hhccccccCCC',
    '.hcccccccCC.',
    '..kkkkkkkk..',
    '..kekeekek..',
    '..kkkkkkkk..',
    '...kKKKkk...',
    '..kyyyyyyk..',
    '..kyyyyyyk..',
    '..kybbbyk...',
    '..kybbbyk...',
    '...bbbbbb...',
    '...bbb.bbbb.',
    '..wwww..www.',
    '..WWWW..WWW.',
  ];

  // Airborne: legs tucked, one arm up.
  var PLAYER_JUMP = [

    '...cccccc...',
    '..cccccccc..',
    '.hhccccccCCC',
    '.hcccccccCC.',
    '..kkkkkkkk..',
    '..kekeekek..',
    '..kkkkkkkk..',
    '...kKKKkk...',
    '.kyyyyyyyk..',
    'kyyyyyyyyk..',
    '.kybbbyyk...',
    '..kybbbyk...',
    '..bbbbbb....',
    '..bbbb.bb...',
    '..wwww.ww...',
    '..WWWW.WW...',
  ];

  // Throwing a water ball: front arm extended toward the player.
  var PLAYER_THROW = [

    '...cccccc...',
    '..cccccccc..',
    '.hhccccccCCC',
    '.hcccccccCC.',
    '..kkkkkkkk..',
    '..kekeekek..',
    '..kkkkkkkk..',
    '...kKKKkk...',
    '..kyyyyyyk..',
    '..kyyybbykk.',
    '..kybbbykk..',
    '..kybbbyk...',
    '..bbbbbb....',
    '..bbbb.bbbb.',
    '..wwww.wwww.',
    '..WWWW.WWWW.',
  ];

  /* ------------------------------------------------------------------ */
  /* Paloma — 12x12 pigeon, hops along the pavement                    */
  /* ------------------------------------------------------------------ */

  var BIRD_A = [

    '.....dd.....',
    '....d..d....',
    '...dddddd...',
    '..dllllllk..',
    '.dllldllllk.',
    'dlllldllllk.',
    'dllllddlllk.',
    'ddllkkdddlk.',
    '.ddddddddkk.',
    '..dddddddd..',
    '.ff......ff.',
    '.ff......ff.',
  ];

  var BIRD_B = [

    '............',
    '.....dd.....',
    '....d..d....',
    '...dddddd...',
    '..dllllllk..',
    '.dllldllllk.',
    'dlllldllllk.',
    'ddllkkdddlk.',
    '.ddddddddkk.',
    '..dddddddd..',
    'ff........ff',
    '.ff......ff.',
  ];

  /* ------------------------------------------------------------------ */
  /* Pelota — 12x12 ball, rolls back and forth                          */
  /* ------------------------------------------------------------------ */

  var BALL_A = [

    '............',
    '....bbbb....',
    '..bbwwwwbb..',
    '.bwwwwwwwwb.',
    '.bwwbbbbwwb.',
    'bwwbwwwwbwwb',
    'bwwbwwwwbwwb',
    'bwwbbbbwwwwb',
    'bwwwwwwbwwb.',
    '.bwwwwwwbb..',
    '..bbbbbb....',
    '............',
  ];

  // Rotated stripe pattern, so the spin reads as motion.
  var BALL_B = [

    '............',
    '....bbbb....',
    '..bbbbwwbb..',
    '.bbwwwwwwbb.',
    '.bwwbwwbbwb.',
    'bwwbwbbwbwwb',
    'bwwbwwwwbwwb',
    'bwwbwwwwbwwb',
    '.bwwbbwwwwb.',
    '..bbwwwwbb..',
    '....bbbb....',
    '............',
  ];

  /* ------------------------------------------------------------------ */
  /* Avispon — 14x12 wasp, flies in a sine wave                        */
  /* ------------------------------------------------------------------ */

  var WASP_A = [

    '...ww....ww...',
    '..wwww..wwww..',
    '...wwwwwwww...',
    '....yyyyyy....',
    '...kykykyky...',
    '...kkykkykk...',
    '...kkkkkkkk...',
    '...kykykyky...',
    '....yyyyeyyy..',
    '.....yyyyy....',
    '......kk......',
    '.......k......',
  ];

  var WASP_B = [

    '..............',
    '..ww....ww....',
    '...wwwwwwww...',
    '....yyyyyy....',
    '...kykykyky...',
    '...kkykkykk...',
    '...kkkkkkkk...',
    '...kykykyky...',
    '....yyyyeyyy..',
    '.....yyyyy....',
    '......kk......',
    '.......k......',
  ];

  /* ------------------------------------------------------------------ */
  /* Street cast — the people, dogs and rides out on the pavement        */
  /* ------------------------------------------------------------------ */

  /*
   * A walker, 12x16, facing right. Deliberately built from the same 12x16
   * box as the player so the two are obviously the same sort of thing at a
   * glance, which matters more on a 400x240 screen than fine detail.
   */
  var WALKER_A = [
    '...hhhhh....',
    '..hhhhhhh...',
    '..hHhhhhH...',
    '..kkkkkkk...',
    '..kekeekk...',
    '..kkKKkkk...',
    '..kooooKk...',
    '.owwwwwwwwo.',
    '.oWwwwwWwo..',
    '..wwwwwwww..',
    '..bwwwwwwb..',
    '..bbbbbbbb..',
    '..bbbbbbbb..',
    '...bbbbbb...',
    '...ss..ss...',
    '...ss..ss...',
  ];

  // Second walk frame: the legs swap over.
  var WALKER_B = [
    '...hhhhh....',
    '..hhhhhhh...',
    '..hHhhhhH...',
    '..kkkkkkk...',
    '..kekeekk...',
    '..kkKKkkk...',
    '..kooooKk...',
    '.owwwwwwwwo.',
    '.oWwwwwWwo..',
    '...wwwwww...',
    '...bbbbbb...',
    '..bbbbbb....',
    '..bbbbb.....',
    '..bbb.bbb...',
    '..ss...ss...',
    '...s...s....',
  ];

  /*
   * A cyclist, 22x18. Wider and taller than the walkers because the bike is,
   * which is also what makes it read instantly as "this one moves fast".
   * The wheels sit on the bottom two rows, so the sprite can be dropped onto
   * the ground row without any per-enemy nudging.
   */
  // A person on a bike, 22x18, facing right. The rider leans forward over the
  // handlebars; the two wheels sit at the bottom with the frame between them.
  var CYCLIST_A = [
    '......................',
    '......................',
    '......hhhh............',
    '.....hhhhhh...........',
    '.....hkkehh...........',
    '.....hhhhhh...........',
    '......oooo............',
    '.....oooooo...........',
    '....oooooooo..........',
    '...oooooooooo.........',
    '...ooooooooo.cc.......',
    '....bbbbbb....cc......',
    '...bbbbbbb....cc......',
    '...bb..bb.....cc......',
    '..MMMM......MMMM......',
    '..MMMM......MMMM......',
    '..MMMM......MMMM......',
    '..MMMM......MMMM......',
  ];

  var CYCLIST_B = [
    '......................',
    '......................',
    '......hhhh............',
    '.....hhhhhh...........',
    '.....hkkehh...........',
    '.....hhhhhh...........',
    '......oooo............',
    '.....oooooo...........',
    '....oooooooo..........',
    '...oooooooooo.........',
    '...ooooooooo.cc.......',
    '....bbbbbb....cc......',
    '...bbbbbbb....cc......',
    '....bb..bb....cc......',
    '..MMMM......MMMM......',
    '..MMMM......MMMM......',
    '..MMMM......MMMM......',
    '..MMMM......MMMM......',
  ];

  /*
   * A street dog, 16x12, facing right. Low and wide, so it stays under the
   * player's jump arc in a way the walkers do not.
   */
  var STREETDOG_A = [

    '................',
    '.....ddd........',
    '...ddddd........',
    '..dddllldd......',
    '.dllelllld......',
    'dllelllllldddd..',
    'dlllllllllllllkd',
    '.dlllllllllllddd',
    '..dddddddddddddd',
    '...dd..dd..dd.dd',
    '..ddd..dd..ddddd',
    '................',
  ];

  var STREETDOG_B = [

    '................',
    '.....ddd........',
    '...ddddd........',
    '..dddllldd......',
    '.dllelllld......',
    'dllelllllldddd..',
    'dlllllllllllllkd',
    '.dlllllllllllddd',
    '..dddddddddddddd',
    '..dd.dddd..dd.dd',
    '.ddd.dd..dd.dddd',
    '................',
  ];

  /* ------------------------------------------------------------------ */
  /* Felipe — the school bully, a boy not a grown-up, 18x22            */
  /* ------------------------------------------------------------------ */

  // A kid: big head, red cap, blue t-shirt, shorts and sneakers. The cap and
  // the shorts are what make him read as a boy rather than a small adult.
  var BOY = {
    c: '#d83848', // cap
    C: '#a01838', // cap shadow
    h: '#50301c', // hair
    s: '#f0c8a0', // skin
    e: '#181828', // eye
    m: '#c08858', // mouth
    t: '#3868c8', // t-shirt
    T: '#203c80', // t-shirt shadow
    k: '#404058', // shorts
    K: '#282838', // shorts shadow
    b: '#f8f8f8', // sneakers
    B: '#c8c8d0'  // sneaker soles
  };

  var BOY_IDLE = [
    '.....cccccc.......',
    '....cccccccc......',
    '....cccccccc......',
    '....hhsssssh......',
    '....hssesesh......',
    '....hssssssh......',
    '.....hsssmh.......',
    '......ssss........',
    '....tttttttt......',
    '...tttttttttt.....',
    '...tttttttttt.....',
    '....tttttttt......',
    '....tttttttt......',
    '.....kkkkkk.......',
    '.....kkkkkk.......',
    '.....kk..kk.......',
    '.....kk..kk.......',
    '.....ss..ss.......',
    '....bbb..bbb......',
    '....bbb..bbb......',
    '...bbbb..bbbb.....',
    '...BBBB..BBBB.....',
  ];

  var BOY_A = [
    '.....cccccc.......',
    '....cccccccc......',
    '....cccccccc......',
    '....hhsssssh......',
    '....hssesesh......',
    '....hssssssh......',
    '.....hsssmh.......',
    '......ssss........',
    '....tttttttt......',
    '...tttttttttt.....',
    '...tttttttttt.....',
    '....tttttttt......',
    '....tttttttt......',
    '.....kkkkkk.......',
    '.....kkkkkk.......',
    '.....kk..kk.......',
    '.....kk..kk.......',
    '.....ss..ss.......',
    '....bbb..bbb......',
    '....bbb..bbb......',
    '...bbbb..bbbb.....',
    '...BBBB..BBBB.....',
  ];

  var BOY_B = [
    '.....cccccc.......',
    '....cccccccc......',
    '....cccccccc......',
    '....hhsssssh......',
    '....hssesesh......',
    '....hssssssh......',
    '.....hsssmh.......',
    '......ssss........',
    '....tttttttt......',
    '...tttttttttt.....',
    '...tttttttttt.....',
    '....tttttttt......',
    '....tttttttt......',
    '.....kkkkkk.......',
    '.....kkkkkk.......',
    '....kk....kk......',
    '....ss....ss......',
    '...bbb......bbb...',
    '...bbb......bbb...',
    '..bbbb......bbbb..',
    '..BBBB......BBBB..',
  ];

  /* ------------------------------------------------------------------ */
  /* Projectiles                                                         */
  /* ------------------------------------------------------------------ */

  // Fireball, 8x8.
  var FIREBALL_GRID = [

    '..ww....',
    '.wyyro..',
    'wyyrroo.',
    'wyyrooo.',
    'wyyrooo.',
    '.yyrroo.',
    '..orroo.',
    '...oo...',
  ];

  // Iceball, 8x8. Same silhouette, cold palette.
  var ICEBALL_GRID = [

    '..ww....',
    '.wccb...',
    'wcwcbdb.',
    'wcwcddb.',
    'wcwcddb.',
    '.wcddb..',
    '..bdb...',
    '...b....',
  ];

  /* ------------------------------------------------------------------ */
  /* Items                                                              */
  /* ------------------------------------------------------------------ */

  // Extra life heart, 10x9.
  var HEART = [

    '.kkk..kkk.',
    'kmmkkkkmmk',
    'kmmmmmmmmk',
    'kmmmmmmmmk',
    'kmmmmmmmmk',
    '.kmmmmmmk.',
    '..kmmmmk..',
    '...kmmk...',
    '....kk....',
  ];

  // Fire flower, 12x12: petals on top, stem and leaves below.
  var FIREFLOWER_GRID = [

    '....oooo....',
    '..ooorrooo..',
    '.oorrrrrroo.',
    'oorrryyrrroo',
    '.orryyyyyro.',
    '..oryyyyro..',
    '...oyyyyo...',
    '....okko....',
    '..ookkkoo...',
    '..ok.kkko...',
    '..okkkkkko..',
    '...okkko....',
  ];

  // Ice flower, same shape so the two pickups are interchangeable at a glance.
  var ICEFLOWER_GRID = [

    '....cccc....',
    '..ccbbccbb..',
    '.ccbbbbbbcc.',
    'ccbbbcwbbbcc',
    '.cbbccwccbb.',
    '..cbcccccb..',
    '...cccccc...',
    '....kkkk....',
    '..kkkkkkkk..',
    '..kk.kkkkk..',
    '..kkkkkkkkk.',
    '...kkkkkk...',
  ];

  /* ------------------------------------------------------------------ */
  /* Choco the dog — 24x20 boss, drawn facing right                      */
  /* ------------------------------------------------------------------ */

  var BOSS_IDLE = [

    '........................',
    '........................',
    '...............dd.......',
    '..............dddd......',
    '.............ddLLdd.....',
    '............ddLLLLdd....',
    '...........ddLLLLLLddd..',
    '..........ddLLweLLLLdd..',
    '.........ddLLweLLLLLLLd.',
    '..d......ddLLLLLwmmLLLdd',
    '.dd.....ddLLLLLwmmkkLLLd',
    '..ddd...ddLLLLLwwwmmLLd.',
    '...dddddLLLLLLwwwmmLLd..',
    '....dddddLLLLLLLwmmmLd..',
    '....ddddLLLLLLLLLLLLd...',
    '...dLLLLdLLLLLLLLLLd....',
    '..dLLLLddLLLLLLLLd......',
    '..dLLLLddLLLLLLLd.......',
    '..dLLLLdLLLLLLLLd.......',
    '..dddddd..dddddd........',
  ];

  // Walk A: front paw forward, back paw trailing.
  var BOSS_WALK_A = [

    '........................',
    '........................',
    '...............dd.......',
    '..............dddd......',
    '.............ddLLdd.....',
    '............ddLLLLdd....',
    '...........ddLLLLLLddd..',
    '..........ddLLweLLLLdd..',
    '.........ddLLweLLLLLLLd.',
    '..d......ddLLLLLwmmLLLdd',
    '.dd.....ddLLLLLwmmkkLLLd',
    '..ddd...ddLLLLLwwwmmLLd.',
    '...dddddLLLLLLwwwmmLLd..',
    '....dddddLLLLLLLwmmmLd..',
    '....ddddLLLLLLLLLLLLd...',
    '...dLLLLdLLLLLLLLLLd....',
    '..dLLLLddLLLLLLLLd......',
    '..dLLLLddLLLLLLLLddd....',
    '..dLLLLdLLLLLLLLd.......',
    '.ddddd...dddddd.........',
  ];

  // Walk B: legs tucked under the body, opposite phase to walk A.
  var BOSS_WALK_B = [

    '........................',
    '........................',
    '...............dd.......',
    '..............dddd......',
    '.............ddLLdd.....',
    '............ddLLLLdd....',
    '...........ddLLLLLLddd..',
    '..........ddLLweLLLLdd..',
    '.........ddLLweLLLLLLLd.',
    '..d......ddLLLLLwmmLLLdd',
    '.dd.....ddLLLLLwmmkkLLLd',
    '..ddd...ddLLLLLwwwmmLLd.',
    '...dddddLLLLLLwwwmmLLd..',
    '....dddddLLLLLLLwmmmLd..',
    '....ddddLLLLLLLLLLLLd...',
    '...dLLLLdLLLLLLLLLLd....',
    '..dLLLLddLLLLLLLLd......',
    '..dLLLLdLLLLLLLd........',
    '..dLLLLddLLLLLLLLd......',
    '...dddddd.ddddd.........',
  ];

  // Defeated: eyes squeezed shut, tongue out, head lowered.
  var BOSS_HURT = [

    '........................',
    '........................',
    '...............dd.......',
    '..............dddd......',
    '.............ddLLdd.....',
    '............ddLLLLdd....',
    '...........ddLLLLLLddd..',
    '..........ddLLeeeLLLddd.',
    '.........ddLLLeeeeLLLdd.',
    '..d......ddLLLLLwmmmLd..',
    '.dd.....ddLLLLLLwmmkkd..',
    '..ddd...ddLLLLLLwwwmmd..',
    '...dddddLLLLLLLwmmdd....',
    '....dddddLLLLLLLLwmd....',
    '....ddddLLLLLLLLLLLLd...',
    '...dLLLLdLLLLLLLLLLd....',
    '..dLLLLddLLLLLLLLd......',
    '..dLLLLddLLLLLLLd.......',
    '..dLLLLdLLLLLLLLd.......',
    '..dddddd..dddddd........',
  ];

  /* ------------------------------------------------------------------ */
  /* Registry                                                           */
  /* ------------------------------------------------------------------ */

  var GRIDS = {
    playerIdle: { rows: PLAYER_IDLE, legend: PLAYER },
    playerRunA: { rows: PLAYER_RUN_A, legend: PLAYER },
    playerRunB: { rows: PLAYER_RUN_B, legend: PLAYER },
    playerRunC: { rows: PLAYER_RUN_C, legend: PLAYER },
    playerJump: { rows: PLAYER_JUMP, legend: PLAYER },
    playerThrow: { rows: PLAYER_THROW, legend: PLAYER },

    birdA: { rows: BIRD_A, legend: BIRD },
    birdB: { rows: BIRD_B, legend: BIRD },

    ballA: { rows: BALL_A, legend: BALL },
    ballB: { rows: BALL_B, legend: BALL },

    waspA: { rows: WASP_A, legend: WASP },
    waspB: { rows: WASP_B, legend: WASP },

    heart: { rows: HEART, legend: { k: '#e8384c', m: '#a01828' } },

    walkerA: { rows: WALKER_A, legend: PERSON },
    walkerB: { rows: WALKER_B, legend: PERSON },

    cyclistA: { rows: CYCLIST_A, legend: CYCLIST },
    cyclistB: { rows: CYCLIST_B, legend: CYCLIST },

    dogA: { rows: STREETDOG_A, legend: STREETDOG },
    dogB: { rows: STREETDOG_B, legend: STREETDOG },

    boyIdle: { rows: BOY_IDLE, legend: BOY },

    fireball: { rows: FIREBALL_GRID, legend: FIREBALL },
    iceball: { rows: ICEBALL_GRID, legend: ICEBALL },

    fireFlower: { rows: FIREFLOWER_GRID, legend: FIREFLOWER },
    iceFlower: { rows: ICEFLOWER_GRID, legend: ICEFLOWER },

    bossIdle: { rows: BOSS_IDLE, legend: DOG },
    bossWalkA: { rows: BOSS_WALK_A, legend: DOG },
    bossWalkB: { rows: BOSS_WALK_B, legend: DOG },
    bossHurt: { rows: BOSS_HURT, legend: DOG }
  };

  /**
   * Rasterise every grid into a Phaser texture.
   *
   * Run frames are also packed into a single horizontal strip so Phaser can
   * animate them with one `anims.create` using frameWidth.
   */
  function createAll(scene) {
    Object.keys(GRIDS).forEach(function (name) {
      JA.pixel.makeGridTexture(scene, 'spr-' + name, GRIDS[name].rows, GRIDS[name].legend);
    });

    // Run cycle: 3 frames side by side, 12px each => 36x16 strip.
    JA.pixel.makeStrip(scene, 'spr-playerRun', [PLAYER_RUN_A, PLAYER_RUN_B, PLAYER_RUN_C], PLAYER);
    JA.pixel.addStripFrames(scene, 'spr-playerRun', 12, 16, 3);

// Boss walk cycle: 2 frames side by side, 24px each => 48x20 strip.
    JA.pixel.makeStrip(scene, 'spr-bossWalk', [BOSS_WALK_A, BOSS_WALK_B], DOG);
    JA.pixel.addStripFrames(scene, 'spr-bossWalk', 24, 20, 2);

    // Street cast walk cycles. Two frames each, so they read as moving without
    // needing a third frame — at 400x240 a three-frame cycle is a blur.
    JA.pixel.makeStrip(scene, 'spr-walkerWalk', [WALKER_A, WALKER_B], PERSON);
    JA.pixel.addStripFrames(scene, 'spr-walkerWalk', 12, 16, 2);

    JA.pixel.makeStrip(scene, 'spr-cyclistWalk', [CYCLIST_A, CYCLIST_B], CYCLIST);
    JA.pixel.addStripFrames(scene, 'spr-cyclistWalk', 22, 18, 2);

    JA.pixel.makeStrip(scene, 'spr-dogWalk', [STREETDOG_A, STREETDOG_B], STREETDOG);
    JA.pixel.addStripFrames(scene, 'spr-dogWalk', 16, 12, 2);

    // Felipe's walk cycle, 2 frames side by side, 18px each => 36x22 strip.
    JA.pixel.makeStrip(scene, 'spr-felipeWalk', [BOY_A, BOY_B], BOY);
    JA.pixel.addStripFrames(scene, 'spr-felipeWalk', 18, 22, 2);

    // Facing-left mirrors, for player, pigeon, ball, wasp and Choco.
    [
      ['spr-playerIdle', 'spr-playerIdleL'],
      ['spr-playerJump', 'spr-playerJumpL'],
      ['spr-playerThrow', 'spr-playerThrowL'],
      ['spr-playerRun', 'spr-playerRunL'],
      ['spr-birdA', 'spr-birdAL'],
      ['spr-birdB', 'spr-birdBL'],
      ['spr-ballA', 'spr-ballAL'],
      ['spr-ballB', 'spr-ballBL'],
      ['spr-waspA', 'spr-waspAL'],
      ['spr-waspB', 'spr-waspBL'],
      ['spr-bossIdle', 'spr-bossIdleL'],
      ['spr-bossHurt', 'spr-bossHurtL'],
      // The street cast turns round, so they need both directions.
      ['spr-walkerWalk', 'spr-walkerWalkL'],
      ['spr-cyclistWalk', 'spr-cyclistWalkL'],
      ['spr-dogWalk', 'spr-dogWalkL'],
      ['spr-fireFlower', 'spr-fireFlowerL'],
      ['spr-iceFlower', 'spr-iceFlowerL']
    ].forEach(function (pair) {
      JA.pixel.makeFlipped(scene, pair[0], pair[1]);
    });
  }

  JA.sprites = { GRIDS: GRIDS, createAll: createAll };
})(window.JA);
