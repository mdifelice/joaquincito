/*
 * GameScene — playing one cuadra.
 *
 * The cuadra arrives as ASCII (see src/data/levels.js) and is turned into
 * sprites and static bodies here. Nothing about a specific level is hard-coded:
 * add a sixth cuadra to the data and it works with no change in this file.
 *
 * Each cuadra is one street block. The obstacles are the solid things in it —
 * kerbs, trees, parked cars — and the threats are the people and dogs walking
 * through it. Fire and ice flowers give powers for dealing with those.
 *
 * Tuning notes, aimed at a six-year-old:
 *   - Coyote time and a jump buffer, so a jump never gets "eaten".
 *   - Touching an enemy costs a life, but so does jumping on its head defeat it.
 *   - Enemies walk slowly and turn at edges and walls, so they are avoidable by
 *     waiting rather than by being precise.
 *   - Checkpoints are frequent and instant.
 *   - The run clock is cumulative and never rewinds, even on a death or a
 *     restart, so getting stuck is what costs time rather than being free.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var TILE = 16;

  var SPEED = 120;          // top running speed, px/s
  var ACCEL = 900;          // how fast we reach it
  var FRICTION = 1300;      // how fast we stop
  var AIR_CONTROL = 0.55;   // fraction of ACCEL usable in mid-air
  // A full jump rises 88px (5.5 tiles), which clears every step the cuadras ask
  // for with room to spare: the maps use 2- and 3-tile rises, and the old 335
  // only reached 62px, so 4-tile walls were literally unreachable.
  var JUMP = -400;          // jump impulse
  var JUMP_CUT = 0.55;      // velocity kept when the button is released early
  var COYOTE_MS = 160;      // grace period after walking off a ledge
  var BUFFER_MS = 160;      // grace period for pressing jump just before landing
  var INVULN_MS = 1600;     // mercy time after getting hurt
  var START_LIVES = 3;

  // --- Powers -------------------------------------------------------------
  var POWER_MS = 20000;      // how long a flower lasts (20 seconds)
  var THROW_SPEED = 210;     // how fast a fire or ice ball travels
  var THROW_RANGE = 150;     // how far it gets before fizzling out, px
  var THROW_COOLDOWN = 260;  // ms between throws
  var FREEZE_MS = 4000;      // how long an iced enemy stays put
  var STOMP_BOUNCE = -260;   // the little hop when landing on an enemy's head

  // --- Felipe, the last cuadra's boss ------------------------------------
  var BOSS_JUMP = -280;      // his hop, a touch lower than the player's
  var BOSS_JUMP_MS = 1700;   // how often he jumps while on the ground
  var BOSS_STUN_MS = 900;    // ice only holds him for a moment, not four seconds

  var Game = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function GameScene() {
      Phaser.Scene.call(this, { key: 'Game' });
    },

    init: function (data) {
      this.levelNumber = (data && data.level) || 1;
      this.level = JA.levels.get(this.levelNumber);
      this.map = JA.levels.parse(this.level);

      this.lives = START_LIVES;
      this.finished = false;
      this.paused = false;

      // `elapsed` is the whole RUN, not this cuadra: it starts at whatever the
      // previous cuadras left behind and keeps counting. `levelStart` is the
      // snapshot needed to work out this cuadra's own time for the best-time
      // record.
      this.levelStart = (data && data.elapsed) || JA.save.getRunTime() || 0;
      this.elapsed = this.levelStart;

      // The run clock is measured against the wall clock rather than the frame
      // delta, because 9:05 has to be nine-oh-five in the real world.
      //
      // Phaser's delta is deliberately smoothed, and is additionally clamped
      // while the window is out of focus, so below 60fps the game runs in slow
      // motion and a delta-based timer quietly loses time. Measured on a
      // 30fps window that cost 29% of the run, which would hand out seven
      // minutes for a five-minute deadline. Wall-clock time has no such drift.
      this.clockAnchor = performance.now() - this.elapsed;
      this.clockHiddenAt = 0;
      this.clockPausedAt = 0;
      this.listenForHiddenTime();

      this.coyote = 0;
      this.buffer = 0;
      this.invuln = 0;
      this.respawn = { tx: this.map.spawn.x, ty: this.map.spawn.y };

      // The furthest safe footing reached, in pixels. Deaths rewind to here
      // rather than to the spawn — see safePoint().
      this.safeX = this.map.spawn.x * TILE + TILE / 2;
      this.safeY = (this.map.spawn.y + 1) * TILE - 8;

      // Touch/pointer state, driven by the HUD buttons as well as the keyboard.
      this.touch = { left: false, right: false, jump: false, throw: false };

      // No power yet: a flower in the level is what grants one.
      this.power = null;
      this.powerLeft = 0;
      this.throwCooldown = 0;
      this.throwHinted = false;

      // The boss and his health pips, rebuilt in create().
      this.boss = null;
      this.bossPips = [];
    },

    /**
     * Stop the clock while the player is not looking at the game.
     *
     * A tabbed-away browser is not "playing", and a six-year-old who stops for
     * a snack should not lose the run to it. So the time spent hidden is simply
     * not charged: on the way back the anchor moves forward by exactly the
     * hidden duration. Physics is untouched — Phaser still slows the world
     * down; only the deadline is held to real time.
     */
    listenForHiddenTime: function () {
      var self = this;

      this.hide = function () {
        if (self.clockHiddenAt) return;      // already hidden
        self.clockHiddenAt = performance.now();
      };

      this.show = function () {
        if (!self.clockHiddenAt) return;
        // Push the anchor forward so the hidden stretch is not billed.
        self.clockAnchor += performance.now() - self.clockHiddenAt;
        self.clockHiddenAt = 0;
        // Re-derive `elapsed` immediately, otherwise the HUD would show a stale
        // time until the next frame.
        self.syncClock();
      };

      // Phaser's TimeStep re-emits window blur/focus on the game emitter
      // (there is no `game.loop.events`), and the DOM visibilitychange below is
      // the belt to its braces.
      var gameEvents = this.game.events;
      if (gameEvents && gameEvents.on) {
        gameEvents.on('blur', this.hide);
        gameEvents.on('focus', this.show);
      }
      if (typeof document !== 'undefined' && document.addEventListener) {
        this.onVisibility = function () {
          if (document.hidden) self.hide(); else self.show();
        };
        document.addEventListener('visibilitychange', this.onVisibility);
      }

      // Leaving the scene must not leave these handlers behind.
      this.events.once('shutdown', function () {
        if (gameEvents && gameEvents.off) {
          gameEvents.off('blur', self.hide);
          gameEvents.off('focus', self.show);
        }
        if (self.onVisibility && document.removeEventListener) {
          document.removeEventListener('visibilitychange', self.onVisibility);
        }
      });
    },

    /** Recompute the run clock from the wall clock. */
    syncClock: function () {
      // Neither hidden nor paused: the clock is deliberately held still in both
      // cases, so the anchor must not be allowed to advance past those stretches.
      if (this.clockHiddenAt || this.clockPausedAt) return;
      this.elapsed = performance.now() - this.clockAnchor;
    },

    /**
     * Force the run clock to a given time. `elapsed` and the wall-clock anchor
     * have to move together, so this is the only supported way to jump the
     * clock — assigning `elapsed` directly would be undone by the next frame.
     */
    setClock: function (ms) {
      this.elapsed = Math.max(this.levelStart, Math.round(ms) || 0);
      this.clockAnchor = performance.now() - this.elapsed;
    },

    create: function () {
      var self = this;

      // --- Art for this cuadra's theme -----------------------------------
      JA.tiles.createForTheme(this, this.level.theme);

      this.buildBackground();
      this.buildTerrain();
      this.buildDecor();
      this.buildPickups();
      this.buildEnemies();
      this.buildBoss();
      this.buildGoal();
      this.buildPlayer();
      this.setupCamera();
      this.setupInput();
      this.setupColliders();

      // --- HUD runs as a separate scene so pausing is trivial ---
      this.scene.launch('Hud', { scene: this });
      this.scene.bringToTop('Hud');

      JA.audio.playMusic('level');

      // Felipe's cuadra swaps the level loop for the tense track. This has to
      // come after the level music above, which would otherwise override it.
      if (this.map.boss) JA.audio.playMusic('boss');

      this.events.once('shutdown', function () {
        JA.audio.stopMusic();
        // The HUD was launched as a separate scene, so it does not shut down
        // with us. Without this it keeps running and draws its bar and any open
        // panel on top of the map or the title screen.
        if (self.scene.isActive('Hud')) self.scene.stop('Hud');
      });
    },

    /* ---------------------------------------------------------------- */
    /* World building                                                    */
    /* ---------------------------------------------------------------- */

    /** Pixel centre of a tile. */
    centre: function (tx, ty) {
      return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
    },

    /**
     * Choose a tile texture for a terrain character.
     * Animated water gets a random frame so a long channel does not look like a
     * repeating pattern.
     */
    tileKey: function (ch) {
      switch (ch) {
        case '=': return 'tile-ground';
        case '-': return 'tile-groundDeep';
        default: return 'tile-solid';
      }
    },

    buildBackground: function () {
      var theme = JA.palette.themes[this.level.theme] || JA.palette.themes.plaza;
      var worldW = this.map.width * TILE;
      var self = this;

      // Phaser wants a numeric colour, and the palette stores CSS strings, so
      // every colour has to be converted on the way in.
      var num = function (hex) {
        return Phaser.Display.Color.HexStringToColor(hex).color;
      };

      // Sky: two stacked rectangles, behind everything.
      this.add.rectangle(worldW / 2, 60, worldW, 120, num(theme.sky[0])).setDepth(-100);
      this.add.rectangle(worldW / 2, 180, worldW, 120, num(theme.sky[1])).setDepth(-100);

      // Parallax bands. Each is a screen-wide TileSprite pinned to the camera
      // and scrolled by hand: sliding its tilePositionX by `factor` times the
      // camera's own scroll makes the band drift more slowly than the world,
      // which is what sells the depth. Doing it this way also means the band
      // never runs out, however long the level is.
      //
      // The height MUST match the source texture. A TileSprite taller than its
      // texture repeats it downwards, which turns a strip of clouds into a
      // solid wall of them.
      var bands = [
        { key: 'prop-clouds', y: 20, alpha: 0.9, factor: 0.1, depth: -90 },
        { key: 'prop-buildings', y: 118, alpha: 0.45, factor: 0.22, depth: -95 },
        { key: 'prop-houses', y: 150, alpha: 0.65, factor: 0.42, depth: -94 },
        { key: 'prop-hills', y: 150, alpha: 0.7, factor: 0.7, depth: -93 }
      ];

      this.bands = bands.map(function (band) {
        var source = self.textures.get(band.key).getSourceImage();
        var strip = self.add.tileSprite(200, band.y, 400, source.height, band.key)
          .setOrigin(0.5, 0.5)
          .setScrollFactor(0)
          .setDepth(band.depth)
          .setAlpha(band.alpha);

        // Squeeze the strip horizontally so the layer drifts slower than the
        // world does. tileScaleY stays at 1 to avoid vertical repetition.
        strip._factor = band.factor;
        return strip;
      });
    },

    buildTerrain: function () {
      var self = this;
      var solids = this.physics.add.staticGroup();

      for (var ty = 0; ty < this.map.height; ty++) {
        for (var tx = 0; tx < this.map.width; tx++) {
          var ch = this.map.index(tx, ty);
          if (ch === '.' || ch === ' ') continue;

          // Things, enemies and decor are placed by their own builders.
          if ('PSKhfi'.indexOf(ch) !== -1) continue;
          if ('prd'.indexOf(ch) !== -1) continue;
          if ('uLYG'.indexOf(ch) !== -1) continue;

          if (this.map.isObstacle(ch)) {
            // Trees and parked cars are props, not tiles: the art is taller and
            // wider than one 16px tile. They are still solid, and the player has
            // to climb them like any other block, so each gets a hidden static
            // body matched to the art.
            //
            // A tree is drawn 32px wide but only its trunk blocks, so the body
            // is narrow and sits low. A car is drawn 48px wide and the whole
            // thing blocks, so its body is nearly as wide as the art.
            var isCar = ch === 'C';
            var artW = isCar ? 48 : 32;
            var bodyW = isCar ? 44 : 12;
            var bodyH = isCar ? 26 : 14;

            var prop = this.add.image(
              tx * TILE + TILE / 2, (ty + 1) * TILE, 'prop-' + this.obstacleKey(ch)
            );
            prop.setDisplaySize(artW, prop.height * (artW / prop.width));
            prop.setOrigin(0.5, 1);
            prop.setDepth(2);

            var body = this.add.rectangle(
              tx * TILE + TILE / 2, (ty + 1) * TILE - bodyH / 2, bodyW, bodyH
            );
            this.physics.add.existing(body, true);
            body.setDepth(1);
            body.visible = false;
            solids.add(body);
            continue;
          }

          var tile = solids.create(tx * TILE, ty * TILE, this.tileKey(ch));
          tile.setOrigin(0, 0).refreshBody();
          tile.setDepth(1);
        }
      }

      this.solids = solids;
    },

    /** Which prop art an obstacle tile uses. */
    obstacleKey: function (ch) {
      return ch === 'C' ? 'car' : 'tree';
    },

    buildDecor: function () {
      var self = this;
      this.map.decor.forEach(function (item) {
        // Props are drawn behind the player and never collide.
        var img = self.add.image(item.x * TILE, (item.y + 1) * TILE, 'prop-' + item.type);
        img.setOrigin(0.5, 1);
        img.setDepth(-1);
      });
    },

    /** Extra lives, power flowers and checkpoint flags. */
    buildPickups: function () {
      var self = this;
      this.heartsGroup = this.physics.add.group({ allowGravity: false, immovable: true });
      this.flowersGroup = this.physics.add.group({ allowGravity: false, immovable: true });
      // Thrown balls live in their own group so they can ignore gravity and be
      // cleared in one go when the cuadra ends.
      this.shotsGroup = this.physics.add.group({ allowGravity: false, immovable: true });

      this.map.things.forEach(function (thing) {
        var p = self.centre(thing.x, thing.y);

        if (thing.type === 'heart') {
          var heart = self.heartsGroup.create(p.x, p.y, 'spr-heart');
          heart.setDepth(3);
          self.tweens.add({ targets: heart, y: p.y - 3, duration: 700, yoyo: true, repeat: -1 });
        } else if (thing.type === 'fireFlower') {
          var fire = self.flowersGroup.create(p.x, p.y, 'spr-fireFlower');
          fire.setData('power', 'fire');
          fire.setDepth(3);
          self.tweens.add({ targets: fire, y: p.y - 3, duration: 700, yoyo: true, repeat: -1 });
        } else if (thing.type === 'iceFlower') {
          var ice = self.flowersGroup.create(p.x, p.y, 'spr-iceFlower');
          ice.setData('power', 'ice');
          ice.setDepth(3);
          self.tweens.add({ targets: ice, y: p.y - 3, duration: 700, yoyo: true, repeat: -1 });
        } else if (thing.type === 'checkpoint') {
          var flag = self.add.image(thing.x * TILE, (thing.y + 1) * TILE, 'prop-flagOff').setOrigin(0.5, 1);
          flag.setDepth(3);
          self.checkpoint = { x: thing.x, y: thing.y, sprite: flag };
        }
      });
    },

    /**
     * The people and dogs out on the street.
     *
     * Each enemy walks at its own speed and turns around when it reaches a wall
     * or the edge of whatever it is standing on. That is deliberately dull AI:
     * a six-year-old can read it, wait for the turn, and walk past. Nothing here
     * chases the player, which is what keeps the block fair.
     *
     * Enemies are not static terrain, so they live in a physics group with
     * collideWorldBounds off and their own overlap handling, rather than being
     * baked into the tile layer.
     */
    buildEnemies: function () {
      var self = this;
      this.enemyGroup = this.physics.add.group();

      this.map.enemies.forEach(function (spot) {
        var spec = spot.spec;
        // Stand the enemy so its feet are on the tile below its marker.
        var x = spot.tx * TILE + TILE / 2;
        var y = (spot.ty + 1) * TILE - spec.h / 2;

        var enemy = self.physics.add.sprite(x, y, 'spr-' + spec.sprite);
        enemy.setDepth(4);
        enemy.body.setSize(spec.w, spec.h);
        // The cyclist sprite is 22px wide but the body only needs to cover the
        // rider and the middle of the bike, so it is nudged in.
        enemy.body.setOffset(2, 1);

        enemy.setData('kind', spot.kind);
        enemy.setData('anim', spec.anim);
        enemy.setData('dir', -1);       // everyone starts walking left
        enemy.setData('speed', spec.speed);
        enemy.setData('frozen', 0);
        enemy.setData('alive', true);
        // Animations are built once in BootScene, not per enemy: creating the
        // same key twice is an error in Phaser, and a cuadra has many walkers.
        enemy.play(spec.anim);

        self.enemyGroup.add(enemy);
      });
    },

    /**
     * Felipe, the boss of the last cuadra.
     *
     * He is deliberately NOT in the enemy group: the crowd's rules (stomp to
     * defeat, ice freezes for four seconds) do not apply to him. He has his own
     * health, jumps, and can only be hurt by thrown balls. He never blocks the
     * road, so a player who would rather run past him can — beating him is the
     * optional, braver route to the school.
     */
    buildBoss: function () {
      this.bossGroup = this.physics.add.group();

      var spot = this.map.boss;
      if (!spot) return;

      var spec = spot.spec;
      var x = spot.tx * TILE + TILE / 2;
      var y = (spot.ty + 1) * TILE - spec.h / 2;

      var boss = this.physics.add.sprite(x, y, 'spr-' + spec.sprite);
      boss.setDepth(6);
      boss.body.setSize(spec.w, spec.h);
      boss.body.setOffset(3, 1);

      boss.setData('kind', spot.kind);
      boss.setData('anim', spec.anim);
      boss.setData('dir', -1);
      boss.setData('speed', spec.speed);
      boss.setData('frozen', 0);
      boss.setData('alive', true);
      boss.setData('hp', spec.hp);
      boss.setData('maxHp', spec.hp);
      boss.setData('jumpIn', BOSS_JUMP_MS);
      boss.play(spec.anim);

      this.bossGroup.add(boss);
      this.boss = boss;
      this.buildBossPips(boss, spec.hp);
    },

    /** Three little pips over Felipe's head, so his health is never a mystery. */
    buildBossPips: function (boss, hp) {
      this.bossPips = [];
      for (var i = 0; i < hp; i++) {
        var pip = this.add.rectangle(boss.x, boss.y, 5, 3, 0xe8384c);
        pip.setDepth(7);
        pip.setData('full', 0xe8384c);
        pip.setData('empty', 0x401018);
        this.bossPips.push(pip);
      }
    },

    /** Keep the pips centred over the boss and coloured by remaining health. */
    updateBossPips: function () {
      if (!this.boss || !this.boss.active) return;
      var hp = this.boss.getData('hp');
      var y = this.boss.body.top - 6;
      var n = this.bossPips.length;
      for (var i = 0; i < n; i++) {
        var pip = this.bossPips[i];
        pip.setPosition(this.boss.x + (i - (n - 1) / 2) * 7, y);
        pip.setFillStyle(i < hp ? pip.getData('full') : pip.getData('empty'));
      }
    },

    buildGoal: function () {
      var goal = this.map.goal;
      var p = this.centre(goal.x, goal.y);
      var isLast = this.levelNumber >= JA.levels.count;

      // The finish of a cuadra is a painted strip across the road with a sign
      // beside it. The sign names the next cuadra, so the player always knows
      // what is coming; on the last one it is the school, because that is
      // where the run ends.
      if (isLast) {
        var school = this.add.image(goal.x * TILE, (goal.y + 1) * TILE, 'prop-school').setOrigin(0.5, 1);
        school.setDepth(3);
      } else {
        // The sign sits clear of the finish line so the two never overlap, and
        // the name is drawn dark on the light board so it is easy to read.
        var signX = goal.x * TILE - 40;
        var sign = this.add.image(signX, (goal.y + 1) * TILE, 'prop-roadSign').setOrigin(0.5, 1);
        sign.setDepth(3);
        var nextName = JA.levels.get(this.levelNumber + 1).name;
        JA.font.text(this, signX, (goal.y + 1) * TILE - 34, nextName, {
          size: 1, originX: 0.5, tint: 0x3a6a48, shadow: 0xf8f8f8
        }).setDepth(4);
      }

      // The checkered line itself, drawn as two rows of alternating tiles so it
      // reads as paint on the road rather than as another block to stand on.
      var lineY = (goal.y + 1) * TILE;
      for (var i = 0; i < 4; i++) {
        var cell = this.add.rectangle(
          goal.x * TILE + i * 4, lineY - 4, 4, 8,
          i % 2 === 0 ? 0xf8f8f8 : 0x282828
        );
        cell.setDepth(2);
      }

      // A door-sized trigger at the finish line.
      this.goalZone = this.add.zone(p.x, (goal.y + 1) * TILE - 10, 16, 20);
      this.physics.add.existing(this.goalZone, true);
    },

    buildPlayer: function () {
      var spawn = this.map.spawn;
      var p = this.centre(spawn.x, spawn.y);

      var player = this.physics.add.sprite(p.x, p.y, 'spr-playerIdle');
      player.setDepth(10);
      player.setCollideWorldBounds(false);

      // Body slightly smaller than the 12x16 art, so brushing past a wall does
      // not read as a hit.
      player.body.setSize(10, 14);
      player.body.setOffset(1, 2);

      // Drop the player onto whatever is under the spawn point.
      player.y = (spawn.y + 1) * TILE - 8;

      this.player = player;
    },

    setupCamera: function () {
      var worldW = this.map.width * TILE;
      this.physics.world.setBounds(0, 0, worldW, 240);
      this.cameras.main.setBounds(0, 0, worldW, 240);

      // Only ever scroll horizontally: a 15-row level is exactly one screen
      // tall, and a level that also moves up and down is much harder to read.
      this.cameras.main.startFollow(this.player, true, 0.12, 0);
      this.cameras.main.setDeadzone(140, 240);
    },

    setupInput: function () {
      var self = this;

      this.cursors = this.input.keyboard.createCursorKeys();
      this.keys = this.input.keyboard.addKeys({
        up: 'W',
        down: 'S',
        left: 'A',
        right: 'D',
        // Space is the big "fire" button a six-year-old already expects; jump
        // lives on W and the up arrow so the two never fight over one key.
        jump: 'W',
        throw: 'SPACE',
        throwAlt: 'J',
        throwAlt2: 'F'
      });

      this.input.keyboard.on('keydown-ESC', function () { self.togglePause(); });
      this.input.keyboard.on('keydown-P', function () { self.togglePause(); });
      this.input.keyboard.on('keydown-R', function () { self.respawnPlayer(true); });
    },

    setupColliders: function () {
      var self = this;

      this.physics.add.collider(this.player, this.solids);
      this.physics.add.collider(this.enemyGroup, this.solids);

      // Extra lives and power flowers are picked up by touching them.
      this.physics.add.overlap(this.player, this.heartsGroup, function (player, heart) {
        self.collectHeart(heart);
      });

      this.physics.add.overlap(this.player, this.flowersGroup, function (player, flower) {
        self.collectFlower(flower);
      });

      // Touching an enemy costs a life, unless the player lands on its head,
      // which defeats it and bounces the player back up instead.
      this.physics.add.overlap(this.player, this.enemyGroup, function (player, enemy) {
        self.hitEnemy(enemy);
      });

      // A thrown ball stops when it hits a wall, and it also stops when it hits
      // an enemy, which is handled in hitEnemy through the same list.
      this.physics.add.overlap(this.shotsGroup, this.enemyGroup, function (shot, enemy) {
        self.shotHitsEnemy(shot, enemy);
      });

      // Felipe is solid ground for himself and a separate threat from the
      // crowd: stomping only bounces the player, balls are what hurt him.
      if (this.bossGroup) {
        this.physics.add.collider(this.bossGroup, this.solids);
        this.physics.add.overlap(this.player, this.bossGroup, function (player, boss) {
          self.hitBoss(boss);
        });
        this.physics.add.overlap(this.shotsGroup, this.bossGroup, function (shot, boss) {
          self.shotHitsBoss(shot, boss);
        });
      }

      this.physics.add.overlap(this.player, this.goalZone, function () {
        self.reachGoal();
      });

      // Checkpoint: flag the cuadra's start to here.
      if (this.checkpoint) {
        this.checkpointZone = this.add.zone(
          this.checkpoint.x * TILE + 8, (this.checkpoint.y + 1) * TILE - 12, 20, 28
        );
        this.physics.add.existing(this.checkpointZone, true);
        this.physics.add.overlap(this.player, this.checkpointZone, function () {
          self.takeCheckpoint();
        });
      }
    },

    /* ---------------------------------------------------------------- */
    /* Per-frame update                                                  */
    /* ---------------------------------------------------------------- */

    update: function (time, delta) {
      if (this.finished) return;

      if (this.paused) {
        // Show a pause badge, but stop simulating the level.
        this.player.setVelocity(0, 0);
        return;
      }

      // The run clock is wall-clock, not frame-delta: see init().
      this.syncClock();
      // Kept in the save so it survives the trip through the map between
      // cuadras. Only the in-memory copy is touched per frame.
      JA.save.setRunTime(this.elapsed);

      this.scrollParallax();
      this.updatePlayer(delta);
      this.updateEnemies(delta);
      this.updateBoss(delta);
      this.updatePowers(delta);
      this.updateShots(delta);
      this.updateTimer();
    },

    scrollParallax: function () {
      var scrollX = this.cameras.main.scrollX;
      this.bands.forEach(function (strip) {
        strip.tilePositionX = scrollX * strip._factor;
      });
    },

    updatePlayer: function (delta) {
      var body = this.player.body;
      var k = this.keys;

      var left = this.cursors.left.isDown || k.left.isDown || this.touch.left;
      var right = this.cursors.right.isDown || k.right.isDown || this.touch.right;
      var jumpDown = this.cursors.up.isDown || k.jump.isDown || this.touch.jump;

      // --- Horizontal --------------------------------------------------
      var accel = body.onFloor() ? ACCEL : ACCEL * AIR_CONTROL;
      if (left && !right) {
        body.setAccelerationX(-accel);
        this.player.setFlipX(true);
      } else if (right && !left) {
        body.setAccelerationX(accel);
        this.player.setFlipX(false);
      } else {
        body.setAccelerationX(0);
      }

      // Clamp to the top speed, but let friction slow us down.
      if (Math.abs(body.velocity.x) > SPEED) {
        body.setVelocityX(Math.sign(body.velocity.x) * SPEED);
      } else if (!left && !right && body.onFloor()) {
        var slow = FRICTION * (delta / 1000);
        body.setVelocityX(Math.abs(body.velocity.x) < slow ? 0 : body.velocity.x - slow * Math.sign(body.velocity.x));
      }

      // --- Jump --------------------------------------------------------
      // Two grace periods make jumping feel forgiving: one for leaving a ledge
      // a moment too late, one for pressing jump a moment too early.
      if (body.onFloor()) this.coyote = COYOTE_MS;
      else this.coyote = Math.max(0, this.coyote - delta);

      if (jumpDown) this.buffer = BUFFER_MS;
      else this.buffer = Math.max(0, this.buffer - delta);

      if (this.buffer > 0 && this.coyote > 0) {
        body.setVelocityY(JUMP);
        this.buffer = 0;
        this.coyote = 0;
        JA.audio.play('jump');
      }

      // Releasing early cuts the jump short, so small hops are possible.
      if (!jumpDown && body.velocity.y < 0) {
        body.setVelocityY(body.velocity.y * JUMP_CUT);
      }

      // --- Animation ---------------------------------------------------
      if (!body.onFloor()) {
        this.player.anims.stop();
        this.player.setTexture('spr-playerJump');
      } else if (Math.abs(body.velocity.x) > 8) {
        this.player.play('player-run', true);
      } else {
        this.player.anims.stop();
        this.player.setTexture('spr-playerIdle');
      }

      // Footing is remembered while the player is standing safely, before the
      // gap check, so a fall into a gap never rewinds past solid road.
      this.rememberSafePoint();

      // --- Throwing ----------------------------------------------------
      if (this.keys.throw.isDown || this.keys.throwAlt.isDown || this.keys.throwAlt2.isDown || this.touch.throw) {
        this.throwBall();
      }

      // --- Falling off the bottom of the block ------------------------
      if (this.player.y > 240 + 24) this.drown();

      // --- Mercy timer -------------------------------------------------
      if (this.invuln > 0) {
        this.invuln -= delta;
        // Blink while invulnerable, so it is obvious the player is safe.
        this.player.setAlpha(Math.floor(this.invuln / 80) % 2 ? 0.3 : 1);
        if (this.invuln <= 0) this.player.setAlpha(1);
      }
    },

    /** The HUD scene, or null if it is not running. */
    hud: function () {
      return this.scene.get('Hud') || null;
    },

    updateTimer: function () {
      var hud = this.hud();
      if (hud && hud.sync) hud.sync();
    },

    /* ---------------------------------------------------------------- */
    /* The crowd                                                         */
    /* ---------------------------------------------------------------- */

    /**
     * Walk each enemy along and turn it around when it hits a wall or reaches
     * the edge of the pavement.
     *
     * Turning is done by looking ahead one pixel in the direction of travel, so
     * an enemy never walks off a kerb: it stops at the edge instead. That is
     * what makes the crowd readable — every enemy stays on its own stretch of
     * pavement and comes back the way it came.
     *
     * An iced enemy stops dead for a few seconds, then carries on as if nothing
     * had happened.
     */
    updateEnemies: function (delta) {
      var TURN_AHEAD = 2;

      this.enemyGroup.getChildren().forEach(function (enemy) {
        if (!enemy.active || !enemy.getData('alive')) return;

        // A frozen enemy is frozen for a fixed stretch: count it down, keep it
        // still, and keep the ice block following it.
        var frozen = enemy.getData('frozen');
        if (frozen > 0) {
          frozen -= delta;
          enemy.setData('frozen', frozen);
          enemy.setVelocityX(0);
          var ice = enemy.getData('ice');
          if (ice) ice.setPosition(enemy.x, enemy.y);
          if (frozen <= 0) this.thawEnemy(enemy);
          return;
        }

        var dir = enemy.getData('dir');
        var speed = enemy.getData('speed');

        // Turn at the lip of a gap: probe one pixel ahead at foot level. There
        // is no collider over a hole, so this has to be read from the tiles.
        var feetY = enemy.y + enemy.body.halfHeight + 2;
        var aheadX = dir > 0 ? enemy.x + enemy.body.halfWidth + TURN_AHEAD
                             : enemy.x - enemy.body.halfWidth - TURN_AHEAD;
        var groundTile = this.map.index(Math.floor(aheadX / TILE), Math.floor(feetY / TILE));

        // Turn when the body is actually pressed against something solid — a
        // wall, a kerb, a tree or a parked car. Reading the physics body's
        // blocked flags handles colliders of any width (a car is 48px on a 16px
        // tile) and, unlike guessing from movement, cannot flip-flop: the flag
        // is only set while the body is genuinely touching something.
        var blocked = enemy.body.blocked.left || enemy.body.blocked.right;
        if (!this.map.isSolid(groundTile) || blocked) dir = -dir;

        // The turn has to be applied BEFORE the velocity, or the next physics
        // step still pushes the old way into the wall and the enemy jitters
        // against it instead of walking away.
        enemy.setData('dir', dir);
        enemy.setVelocityX(dir * speed);
        enemy.setFlipX(dir > 0);
        enemy.play(enemy.getData('anim'), true);
      }, this);
    },

    /**
     * Wrap an enemy in ice: stop it, tint it, and drop a block over it.
     *
     * `ms` lets Felipe be only briefly stunned by ice instead of frozen solid
     * for the crowd's full four seconds.
     */
    freezeEnemy: function (enemy, ms) {
      enemy.setData('frozen', ms || FREEZE_MS);
      enemy.setVelocityX(0);
      enemy.anims.stop();
      enemy.setTint(0x9ad8f8);

      var ice = this.add.image(enemy.x, enemy.y, 'prop-ice').setDepth(enemy.depth + 1);
      ice.setDisplaySize(enemy.body.width + 6, enemy.body.height + 7);
      enemy.setData('ice', ice);
    },

    /** Let a frozen enemy move again, removing the ice block and the tint. */
    thawEnemy: function (enemy) {
      enemy.clearTint();
      var ice = enemy.getData('ice');
      if (ice) {
        ice.destroy();
        enemy.setData('ice', null);
      }
    },

    /**
     * The player and an enemy touched. Landing on its head defeats it; walking
     * into its side costs a life.
     */
    hitEnemy: function (enemy) {
      if (!enemy.active || !enemy.getData('alive')) return;
      // A mercy timer stops the overlap firing every frame and taking every
      // life in the block at once.
      if (this.invuln > 0 || this.finished) return;

      var body = this.player.body;
      // A stomp is landing on the head: falling, and the player's feet are still
      // in the top part of the enemy rather than level with its middle. Arcade
      // bodies have no `h`, so the height comes from `body.height`.
      var stomping = body.velocity.y > 0 &&
        (body.bottom - enemy.body.top) < enemy.body.height * 0.7;

      if (stomping) {
        // Bounce up and let the player keep going: a stomp should feel like a
        // reward, not like a punishment for trying to fight.
        body.setVelocityY(STOMP_BOUNCE);
        this.defeatEnemy(enemy, true);
      } else {
        this.hurt();
      }
    },

    /** Remove an enemy, with a small puff so the hit reads as deliberate. */
    defeatEnemy: function (enemy, squash) {
      enemy.setData('alive', false);
      // A frozen enemy still has its ice block and tint; clear them so a
      // defeated walker does not leave an ice cube floating in the street.
      this.thawEnemy(enemy);
      JA.audio.play(squash ? 'stomp' : 'ballHit');

      var sprite = this.add.image(enemy.x, enemy.y - 4, enemy.texture.key);
      sprite.setFlipX(enemy.flipX);
      sprite.setDepth(4);

      this.tweens.add({
        targets: sprite,
        y: enemy.y - 14,
        alpha: 0,
        duration: 240,
        onComplete: function () { sprite.destroy(); }
      });

      enemy.destroy();
    },

    /* ---------------------------------------------------------------- */
    /* Fire and ice                                                      */
    /* ---------------------------------------------------------------- */

    /** Walking into a flower gives its power for a while. */
    collectFlower: function (flower) {
      if (!flower.active) return;
      this.power = flower.getData('power');
      this.powerLeft = POWER_MS;
      flower.destroy();
      JA.audio.play('powerup');
      this.hud().onPower();

      // Explain the throw the first time a power is picked up; after that the
      // HUD's "FUEGO ESPACIO" / "HIELO ESPACIO" readout is reminder enough.
      if (!this.throwHinted) {
        this.throwHinted = true;
        this.hud().showBanner('DISPARA CON ESPACIO (O J)');
      }
    },

    /**
     * Throw a ball if the player has a power and the cooldown has passed.
     *
     * Fire defeats an enemy outright. Ice does not kill it: it stops it where it
     * stands for a few seconds, which is enough to walk past it, and it starts
     * walking again afterwards.
     */
    throwBall: function () {
      if (!this.power) return;
      // The cooldown is ticked down in updatePowers; holding the key just means
      // the throw is attempted every frame and only one of them gets through.
      if (this.throwCooldown > 0) return;

      var facing = this.player.flipX ? -1 : 1;
      var shot = this.shotsGroup.create(
        this.player.x + facing * 8, this.player.y - 2,
        this.power === 'fire' ? 'spr-fireball' : 'spr-iceball'
      );
      shot.setDepth(5);
      shot.setData('power', this.power);
      shot.setData('travelled', 0);
      shot.setFlipX(facing < 0);
      shot.body.setAllowGravity(false);
      shot.setVelocityX(facing * THROW_SPEED);

      this.throwCooldown = THROW_COOLDOWN;
      JA.audio.play('throwBall');
    },

    updatePowers: function (delta) {
      if (this.throwCooldown > 0) this.throwCooldown -= delta;

      if (!this.power) return;
      this.powerLeft -= delta;
      // The power runs out on its own rather than being taken away, so the HUD
      // is the only warning and the player learns to use it before it fades.
      if (this.powerLeft <= 0) {
        this.power = null;
        this.powerLeft = 0;
        this.hud().onPower();
      }
    },

    updateShots: function (delta) {
      this.shotsGroup.getChildren().slice().forEach(function (shot) {
        if (!shot.active) return;

        shot.setData('travelled', shot.getData('travelled') + Math.abs(shot.body.velocity.x) * (delta / 1000));

        // A ball that has travelled far enough fizzles out, so the street does
        // not fill up with fire and ice.
        if (shot.getData('travelled') >= THROW_RANGE) {
          shot.destroy();
        }
      });
    },

    shotHitsEnemy: function (shot, enemy) {
      if (!shot.active || !enemy.active || !enemy.getData('alive')) return;

      if (shot.getData('power') === 'fire') {
        this.defeatEnemy(enemy, false);
      } else {
        // Ice: stop it, but leave it standing so it starts walking again later.
        this.freezeEnemy(enemy);
      }

      shot.destroy();
    },

    /* ---------------------------------------------------------------- */
    /* Felipe                                                            */
    /* ---------------------------------------------------------------- */

    /**
     * Felipe patrols and hops. Movement mirrors the crowd's turn-at-edges AI —
     * a horizontal turn, applied before the velocity so he never jitters
     * against a wall — but he also jumps on a timer while he has footing.
     */
    updateBoss: function (delta) {
      var boss = this.boss;
      if (!boss || !boss.active || !boss.getData('alive')) return;

      // An iced Felipe is held still for a moment, ice block and all.
      var frozen = boss.getData('frozen');
      if (frozen > 0) {
        frozen -= delta;
        boss.setData('frozen', frozen);
        boss.setVelocityX(0);
        var ice = boss.getData('ice');
        if (ice) ice.setPosition(boss.x, boss.y);
        if (frozen <= 0) this.thawEnemy(boss);
        this.updateBossPips();
        return;
      }

      var dir = boss.getData('dir');
      var speed = boss.getData('speed');

      var feetY = boss.y + boss.body.halfHeight + 2;
      var TURN_AHEAD = 2;
      var aheadX = dir > 0 ? boss.x + boss.body.halfWidth + TURN_AHEAD
                           : boss.x - boss.body.halfWidth - TURN_AHEAD;
      var groundTile = this.map.index(Math.floor(aheadX / TILE), Math.floor(feetY / TILE));
      var blocked = boss.body.blocked.left || boss.body.blocked.right;
      if (!this.map.isSolid(groundTile) || blocked) dir = -dir;

      boss.setData('dir', dir);
      boss.setVelocityX(dir * speed);
      boss.setFlipX(dir > 0);
      boss.play(boss.getData('anim'), true);

      // Hop now and then. Only from the floor, so he never double-jumps.
      var jumpIn = boss.getData('jumpIn') - delta;
      if (jumpIn <= 0 && boss.body.onFloor()) {
        boss.setVelocityY(BOSS_JUMP);
        jumpIn = BOSS_JUMP_MS;
      }
      boss.setData('jumpIn', jumpIn);

      this.updateBossPips();
    },

    /** The player touched Felipe. Landing on him only bounces; the rest hurts. */
    hitBoss: function (boss) {
      if (!boss.active || !boss.getData('alive')) return;
      if (this.invuln > 0 || this.finished) return;

      var body = this.player.body;
      var stomping = body.velocity.y > 0 &&
        (body.bottom - boss.body.top) < boss.body.height * 0.7;

      if (stomping) {
        // He is too big to squash: the player just bounces off, unharmed.
        body.setVelocityY(STOMP_BOUNCE);
        JA.audio.play('stomp');
      } else {
        this.hurt();
      }
    },

    /** A thrown ball reached Felipe. Fire and ice both count, three of them. */
    shotHitsBoss: function (shot, boss) {
      if (!shot.active || !boss.active || !boss.getData('alive')) return;

      var power = shot.getData('power');
      shot.destroy();

      // Ice also holds him for a moment, which is the reward for using it.
      if (power === 'ice') this.freezeEnemy(boss, BOSS_STUN_MS);
      this.damageBoss(boss, 1);
    },

    /** Take a hit, flash, update the pips, and finish him off at zero. */
    damageBoss: function (boss, amount) {
      if (!boss.active || !boss.getData('alive')) return;

      var hp = Math.max(0, boss.getData('hp') - amount);
      boss.setData('hp', hp);
      JA.audio.play('ballHit');

      // A white flash makes the hit land even at this size.
      boss.setTintFill(0xffffff);
      this.time.delayedCall(90, function () {
        if (boss.active) boss.clearTint();
      });

      this.updateBossPips();

      if (hp <= 0) {
        this.defeatBoss(boss);
      } else {
        this.hud().showBanner('FELIPE ' + hp + '/' + boss.getData('maxHp'));
      }
    },

    /** Beating Felipe is optional: he drops a heart and the way stays open. */
    defeatBoss: function (boss) {
      boss.setData('alive', false);
      this.thawEnemy(boss);
      boss.clearTint();
      JA.audio.play('stomp');

      this.bossPips.forEach(function (pip) { pip.destroy(); });
      this.bossPips = [];

      var heart = this.heartsGroup.create(boss.x, boss.y - 6, 'spr-heart');
      heart.setDepth(6);
      this.tweens.add({ targets: heart, y: boss.y - 9, duration: 700, yoyo: true, repeat: -1 });

      var puff = this.add.image(boss.x, boss.y - 6, boss.texture.key);
      puff.setFlipX(boss.flipX);
      puff.setDepth(5);
      this.tweens.add({
        targets: puff,
        y: boss.y - 22,
        alpha: 0,
        duration: 320,
        onComplete: function () { puff.destroy(); }
      });

      boss.destroy();
      this.boss = null;
      // The threat is over: drop the tense track and go back to the level loop.
      JA.audio.playMusic('level');
      this.hud().showBanner('FELIPE DERROTADO');
    },

    /* ---------------------------------------------------------------- */
    /* Events                                                           */
    /* ---------------------------------------------------------------- */

    collectHeart: function (heart) {
      if (!heart.active) return;
      heart.destroy();
      this.lives++;
      JA.audio.play('powerup');
      this.hud().onLives();
    },

    takeCheckpoint: function () {
      if (!this.checkpoint || this.checkpoint.taken) return;
      this.checkpoint.taken = true;
      this.checkpoint.sprite.setTexture('prop-flagOn');
      this.respawn = { tx: this.checkpoint.x, ty: this.checkpoint.y };
      JA.audio.play('checkpoint');
    },

    /**
     * The player bumped into a person or a dog. Costs a life and bounces them
     * back the way they were going.
     */
    hurt: function (dir) {
      if (this.invuln > 0 || this.finished) return;

      this.player.body.setVelocityY(-180);
      this.player.body.setVelocityX((dir || (this.player.body.velocity.x < 0 ? 1 : -1)) * 90);
      this.respawnPlayer(false);
    },

    /** Falling off the bottom of the block. Costs a life. */
    drown: function () {
      if (this.finished || this.invuln > 0) return;
      this.respawnPlayer(false);
    },

    /**
     * Where a death should put the player back: the furthest point they have
     * safely stood on, which is never the start of the cuadra.
     *
     * Checkpoints are sparse and, on the first cuadra, there is only one — so
     * respawning only at flags meant a single mistake before the flag threw away
     * everything since the level began. `safeX` is the furthest point on solid,
     * non-hazard ground the player has touched, so dying costs the player the
     * few metres they had just covered rather than the whole level.
     */
    safePoint: function () {
      var checkpointX = this.respawn.tx * TILE + TILE / 2;
      var checkpointY = (this.respawn.ty + 1) * TILE - 8;

      if (this.safeX > checkpointX) {
        return { x: this.safeX, y: this.safeY };
      }
      return { x: checkpointX, y: checkpointY };
    },

    /** Remember standing on solid ground, so a death can undo only that. */
    rememberSafePoint: function () {
      var body = this.player.body;
      if (!body.onFloor()) return;

      var x = this.player.x;
      var y = this.player.y;

      // Only record road or kerb. A tile of a tree or car body is solid to walk
      // on but makes a poor place to respawn, since it is narrow and tall.
      var tile = this.map.index(Math.floor(x / TILE), Math.floor((y + 8) / TILE));
      if (!this.map.isRoad(tile)) return;

      if (x > this.safeX) {
        this.safeX = x;
        this.safeY = y;
      }
    },

    respawnPlayer: function (voluntary) {
      if (this.finished) return;

      if (voluntary) {
        // R restarts the cuadra from the beginning, not from the checkpoint.
        // The run clock is carried across the restart, so retrying always
        // costs time — that is the whole tension of the 9:00-9:05 deadline.
        this.scene.restart({ level: this.levelNumber, elapsed: this.elapsed });
        return;
      }

      this.lives--;
      this.hud().onLives();
      JA.audio.play('die');

      if (this.lives <= 0) {
        this.gameOver();
        return;
      }

      // Back to the last patch of solid ground, not to the start of the cuadra.
      var target = this.safePoint();
      this.player.setPosition(target.x, target.y);
      this.player.body.setVelocity(0, 0);
      this.player.setAlpha(1);
      this.invuln = INVULN_MS;
    },

    reachGoal: function () {
      if (this.finished) return;

      this.finished = true;
      this.player.setVelocity(0, 0);

      var levelTimeMs = this.elapsed - this.levelStart;
      var isLast = this.levelNumber >= JA.levels.count;
      var onTime = this.elapsed <= JA.save.getRunLimit();

      // Finishing the last cuadra is the end of the run, so it gets the
      // celebration track. An earlier cuadra just keeps the level loop going.
      if (isLast) {
        JA.audio.playMusic('victory');
      } else {
        JA.audio.play('levelClear');
      }

      JA.save.completeLevel(this.levelNumber, { timeMs: levelTimeMs });
      JA.save.setLastLevel(Math.min(this.levelNumber + 1, JA.levels.count));
      // The run clock is now worth persisting: a page reload between cuadras
      // must not hand the player a free restart.
      JA.save.flush();

      // After the last cuadra the run is judged and the clock is done with.
      if (isLast) JA.save.endRun();

      // Let the last few steps play out before the panel appears, so finishing
      // a cuadra does not feel like the game grabbing it away.
      var self = this;
      this.time.delayedCall(600, function () {
        self.hud().showLevelClear(isLast, levelTimeMs, onTime);
      });
    },

    gameOver: function () {
      this.finished = true;
      this.player.setVisible(false);
      JA.audio.play('gameOver');
      JA.audio.stopMusic();

      var self = this;
      this.time.delayedCall(700, function () {
        self.hud().showGameOver();
      });
    },

    togglePause: function () {
      if (this.finished) return;
      this.paused = !this.paused;

      if (this.paused) {
        // Pausing is not playing, so the run clock stops too. Without this the
        // wall clock kept charging through the pause menu.
        this.clockPausedAt = performance.now();
        this.physics.world.pause();
        this.hud().showPause();
      } else {
        // Push the anchor forward by exactly the paused stretch, so resuming
        // neither refunds it nor bills it.
        this.clockAnchor += performance.now() - this.clockPausedAt;
        this.clockPausedAt = 0;
        this.physics.world.resume();
        this.hud().hidePause();
      }
      JA.audio.play('pause');
    },

    /**
     * Leave the paused state without going through the toggle, for the HUD
     * buttons that jump straight to another scene. The clock anchor still has
     * to be advanced, or the paused stretch would be billed to the run.
     */
    clearPause: function () {
      if (this.clockPausedAt) {
        this.clockAnchor += performance.now() - this.clockPausedAt;
        this.clockPausedAt = 0;
      }
      this.paused = false;
      this.physics.world.resume();
    },

    /** Called by the HUD buttons. */
    continueFromOverlay: function () {
      this.clearPause();
      var next = Math.min(this.levelNumber + 1, JA.levels.count);
      this.scene.start('Game', { level: next, elapsed: this.elapsed });
    },

    /** Restart this cuadra. The run clock keeps counting, so a retry costs. */
    restartLevel: function () {
      this.scene.start('Game', { level: this.levelNumber, elapsed: this.elapsed });
    },

    /** Start the whole run over from the first cuadra, with the clock at 9:00. */
    restartRun: function () {
      JA.save.beginRun();
      this.scene.start('Game', { level: 1, elapsed: 0 });
    },

    goToMap: function () {
      // Leaving mid-run must not lose the clock.
      JA.save.setRunTime(this.elapsed);
      JA.save.flush();
      this.scene.start('Map');
    }
  });

  JA.scenes = JA.scenes || {};
  JA.scenes.Game = Game;
})(window.JA);
