/*
 * MapScene — the road to school.
 *
 * Each level is a node on a winding path. Only the next block unlocks after
 * finishing the current one, so a child always knows exactly where to go next.
 * Locked nodes still show, greyed out, to make the whole route feel like a
 * journey rather than a locked door.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var Map = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function MapScene() {
      Phaser.Scene.call(this, { key: 'Map' });
    },

    create: function () {
      var self = this;

      JA.audio.playMusic('title');

      this.cameras.main.setBackgroundColor('#a8dcf8');
      this.drawScenery();

      JA.font.text(this, 200, 12, 'EL CAMINO AL COLEGIO', { size: 2, originX: 0.5, tint: 0xffffff, shadow: 0x1a3a68 });

      // While a run is in progress the clock is shown here too, so the player
      // can see what they are spending before they pick the next cuadra. The
      // deadline is a fixed 9:05, so it is printed next to the current time
      // rather than being mistaken for one.
      if (JA.save.isRunActive()) {
        var now = JA.save.getRunTime();
        var line =
          'AHORA ' + JA.save.clockLabel(now) +
          '  LIMITE ' + JA.save.clockLabel(JA.save.getRunLimit());
        JA.font.text(this, 200, 32, line, {
          size: 1,
          originX: 0.5,
          tint: now > JA.save.getRunLimit() ? 0xff9090 : 0xffffff,
          shadow: 0x1a3a68
        });
      }

      var unlocked = JA.save.get().unlocked;

      this.buildPath(unlocked);

      // --- Back to the title -------------------------------------------
      var back = this.add.rectangle(28, 220, 44, 18, 0xf8f0d0).setStrokeStyle(2, 0x8a5a28);
      JA.font.text(this, 28, 220, 'VOLVER', { size: 1, originX: 0.5, originY: 0.5, tint: 0x30200c });
      back.setInteractive(new Phaser.Geom.Rectangle(-22, -9, 44, 18), Phaser.Geom.Rectangle.Contains);
      back.on('pointerdown', function () {
        JA.audio.play('back');
        self.scene.start('Title');
      });

      this.input.keyboard.once('keydown', function (event) {
        if (event.code === 'Escape') self.scene.start('Title');
      });
    },

    /**
     * Draw the winding road and drop a node on it for every level.
     *
     * Node positions come from each level's `map` field, so a level can be
     * nudged around later without touching this scene.
     */
    buildPath: function (unlocked) {
      var self = this;
      var levels = JA.levels.list;

      // One straight road: every node sits on the same line, so the route reads
      // as a single walk to school rather than a zig-zag.
      var points = [{ x: 8, y: 180 }];
      levels.forEach(function (level) {
        points.push({ x: level.map.x, y: level.map.y });
      });
      points.push({ x: 392, y: 180 });

      // Three passes: a dark kerb, a lighter tarmac, then a dashed centre line.
      var road = this.add.graphics();
      road.lineStyle(14, 0x8a6a48, 1);
      road.strokePoints(points.map(function (p) { return new Phaser.Geom.Point(p.x, p.y); }), false, 14);
      road.lineStyle(10, 0xc8b090, 1);
      road.strokePoints(points.map(function (p) { return new Phaser.Geom.Point(p.x, p.y); }), false, 10);
      road.lineStyle(1, 0xf8f0d0, 1);
      road.strokePoints(points.map(function (p) { return new Phaser.Geom.Point(p.x, p.y); }), false, 1);

      levels.forEach(function (level, index) {
        var number = index + 1;
        var open = number <= unlocked;
        var done = JA.save.isCompleted(number);

        // Node icon: done (a star), open (a bouncy circle), locked (a padlock).
        var icon;
        if (done) {
          icon = self.add.image(level.map.x, level.map.y, 'prop-star').setScale(2);
        } else if (open) {
          icon = self.add.image(level.map.x, level.map.y, 'prop-nodeOpen').setScale(1.6);
          self.tweens.add({
            targets: icon,
            scale: 1.8,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        } else {
          icon = self.add.image(level.map.x, level.map.y, 'prop-nodeLocked').setScale(1.6);
        }

        // The cuadra's name, so the route reads as a journey through places
        // rather than a list of numbers.
        JA.font.text(self, level.map.x, level.map.y - 22, level.name, {
          size: 1,
          originX: 0.5,
          tint: open ? 0xffffff : 0x9a9a9a,
          shadow: 0x1a3a68
        });

        // Number badge under the node.
        JA.font.text(self, level.map.x, level.map.y + 14, String(number), {
          size: 1,
          originX: 0.5,
          tint: open ? 0x30200c : 0x6a6a6a,
          shadow: open ? 0xf8f0d0 : 0x000000
        });

        // Only open nodes respond to a click.
        if (!open) return;

        icon.setInteractive(new Phaser.Geom.Rectangle(-8, -8, 16, 16), Phaser.Geom.Rectangle.Contains);
        icon.on('pointerdown', function () {
          JA.audio.play('confirm');
          // Entering a cuadra from the map mid-run keeps the clock running; with
          // no run in progress, jumping straight in starts one at 9:00.
          if (!JA.save.isRunActive()) JA.save.beginRun();
          self.scene.start('Game', { level: number, elapsed: JA.save.getRunTime() });
        });
      });

      // Joaquincito stands at the last cuadra reached, so the map shows where he
      // is. Guarded, because a hand-edited or brand-new save can unlock nothing.
      var here = levels[Math.max(0, Math.min(unlocked, levels.length) - 1)];
      if (here) {
        var hero = this.add.sprite(here.map.x, here.map.y - 14, 'spr-playerIdle');
        hero.setScale(1.5);
        this.tweens.add({
          targets: hero,
          y: here.map.y - 18,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }

      // The school at the end of the road.
      this.add.image(392, 96, 'prop-school').setOrigin(0.5, 1);
    },

    drawScenery: function () {
      var theme = JA.palette.themes.plaza;

      this.add.rectangle(200, 60, 400, 120, Phaser.Display.Color.HexStringToColor(theme.sky[0]).color);
      this.add.rectangle(200, 120, 400, 120, Phaser.Display.Color.HexStringToColor(theme.sky[1]).color);

      var hills = this.add.image(60, 130, 'prop-hills').setOrigin(0, 1).setScale(1.8, 1.2);
      hills.setAlpha(0.8);
      this.add.image(260, 130, 'prop-hills').setOrigin(0, 1).setScale(1.4, 1);
      hills.setAlpha(0.8);

      this.add.image(40, 30, 'prop-clouds').setScale(1.3);
      this.add.image(300, 46, 'prop-clouds').setScale(1.0);

      // Grass down to the bottom of the screen.
      this.add.tileSprite(200, 232, 400, 24, 'tile-ground').setOrigin(0.5, 0.5);
      this.add.tileSprite(200, 246, 400, 16, 'tile-groundDeep').setOrigin(0.5, 0.5);
    }
  });

  JA.scenes = JA.scenes || {};
  JA.scenes.Map = Map;
})(window.JA);
