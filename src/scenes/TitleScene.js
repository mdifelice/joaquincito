/*
 * TitleScene — the front door.
 *
 * Shows the game name, Joaquincito idling, and a small menu. Deliberately
 * sparse: a 6-year-old should be able to press one key and start playing.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var Title = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function TitleScene() {
      Phaser.Scene.call(this, { key: 'Title' });
    },

    create: function () {
      var self = this;

      JA.audio.playMusic('title');

      this.cameras.main.setBackgroundColor('#68b8f8');

      this.drawScenery();

      // --- Title -------------------------------------------------------
      JA.font.text(this, 200, 26, 'LAS AVENTURAS DE', { size: 2, originX: 0.5, tint: 0xffffff, shadow: 0x1a3a68 }).setDepth(10);
      JA.font.text(this, 200, 48, 'JOAQUINCITO', { size: 4, originX: 0.5, tint: 0xf8d038, shadow: 0x8a3a10 }).setDepth(10);

      // --- Menu --------------------------------------------------------
      var unlocked = JA.save.get().unlocked;
      var resuming = JA.save.isRunActive();

      // A run in progress is resumable, and its clock is still ticking, so the
      // button offers to continue rather than throwing the work away. With no
      // run in progress, playing starts a fresh one at 9:00.
      this.addButton(200, 132, resuming ? 'CONTINUAR' : 'JUGAR', function () {
        if (resuming) {
          self.startLevel(Math.min(JA.save.getLastLevel(), unlocked), JA.save.getRunTime());
        } else {
          JA.save.beginRun();
          self.startLevel(1, 0);
        }
      });

      this.addButton(200, 162, 'MAPA', function () {
        JA.audio.play('select');
        self.scene.start('Map');
      });

      this.addButton(200, 192, 'AJUSTES', function () {
        JA.audio.play('select');
        self.showSettings();
      });

      // --- Footer ------------------------------------------------------
      JA.font.text(this, 8, 226, 'DE 9:00 A 9:05', { tint: 0xffffff, shadow: 0x1a3a68 });
      JA.font.text(this, 392, 226, 'CUADRA ' + unlocked + '/' + JA.levels.count, { originX: 1, tint: 0xffffff, shadow: 0x1a3a68 });

      // Any key jumps straight in, because that is what a child will do —
      // unless a menu is open, where keys are used to make choices.
      this.modalOpen = false;
      this.input.keyboard.once('keydown', function () {
        if (self.modalOpen) return;
        if (resuming) {
          self.startLevel(Math.min(JA.save.getLastLevel(), unlocked), JA.save.getRunTime());
        } else {
          JA.save.beginRun();
          self.startLevel(1, 0);
        }
      });
    },

    /** A chunky, obvious menu button. */
    addButton: function (x, y, label, onClick) {
      var scene = this;

      var w = JA.font.measure(label, 2) + 24;
      var h = 22;
      var box = this.add.rectangle(x, y, w, h, 0xf8f0d0).setStrokeStyle(2, 0x8a5a28);
      JA.font.text(this, x, y, label, { size: 2, originX: 0.5, originY: 0.5, tint: 0x30200c });

      // Fill changes on hover so it is obvious what is selected.
      box.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
      box.on('pointerover', function () { box.setFillStyle(0xf8d038); });
      box.on('pointerout', function () { box.setFillStyle(0xf8f0d0); });
      box.on('pointerdown', function () {
        JA.audio.play('confirm');
        onClick();
      });

      return box;
    },

    drawScenery: function () {
      var theme = JA.palette.themes.plaza;

      // Sky gradient, faked with two stacked rectangles.
      this.add.rectangle(200, 60, 400, 120, Phaser.Display.Color.HexStringToColor(theme.sky[0]).color);
      this.add.rectangle(200, 120, 400, 120, Phaser.Display.Color.HexStringToColor(theme.sky[1]).color);

      // Parallax bands.
      var hills = this.add.image(120, 150, 'prop-hills').setOrigin(0, 1).setScale(1.6, 1);
      var buildings = this.add.image(300, 150, 'prop-buildings').setOrigin(0, 1).setScale(1.6, 1);
      hills.setAlpha(0.85);
      buildings.setAlpha(0.6);

      // Clouds.
      this.add.image(70, 34, 'prop-clouds').setScale(1.4);
      this.add.image(250, 60, 'prop-clouds').setScale(1.1);
      this.add.image(370, 28, 'prop-clouds').setScale(0.9);

      // Ground strip along the bottom.
      var ground = this.add.tileSprite(200, 210, 400, 30, 'tile-ground');
      ground.setOrigin(0.5, 0.5);
      this.add.tileSprite(200, 234, 400, 16, 'tile-groundDeep').setOrigin(0.5, 0.5);

      // Joaquincito idling on the grass, waving at whoever just arrived.
      var hero = this.add.sprite(200, 118, 'spr-playerIdle');
      hero.setScale(3);
      hero.play('player-run');
      hero.anims.pause();

      // Slow, gentle bob so the screen never feels frozen.
      this.tweens.add({
        targets: hero,
        y: 112,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.add.image(300, 196, 'prop-school').setOrigin(0.5, 1);
    },

    showSettings: function () {
      var scene = this;
      var settings = JA.save.getSettings();

      // While this is open, the "press any key to play" shortcut must not fire.
      this.modalOpen = true;

      // A simple modal: a dim backdrop, then a panel with two sliders.
      var backdrop = this.add.rectangle(200, 120, 400, 240, 0x000000, 0.6).setInteractive();
      backdrop.setDepth(20);

      var panel = this.add.rectangle(200, 120, 240, 130, 0xf8f0d0).setStrokeStyle(3, 0x8a5a28).setDepth(21);

      var title = JA.font.text(this, 200, 66, 'AJUSTES', { size: 2, originX: 0.5, tint: 0x30200c }).setDepth(22);

      JA.font.text(this, 130, 100, 'MUSICA', { size: 1, originX: 0.5, tint: 0x30200c }).setDepth(22);
      JA.font.text(this, 130, 128, 'SONIDOS', { size: 1, originX: 0.5, tint: 0x30200c }).setDepth(22);

      // Volume bars: eleven little squares, clicked to set a level. The extra
      // square at the far left is zero, so it is possible to mute completely.
      var STEPS = 11;
      var STEP_X = 8;

      /**
       * Build one volume bar and return a function that redraws it.
       *
       * Each bar keeps its own cell list in this closure. Sharing one list
       * between the two bars would mean drawing the second one destroys the
       * first, leaving its row dead.
       *
       * Each cell also captures its own step: a `var` loop variable is shared
       * by every handler, so clicking any square would set the volume from the
       * value the loop happened to finish on. Redrawing destroys the previous
       * squares, otherwise every click stacks another bar on top and the
       * stale cells underneath keep swallowing the clicks.
       */
      var makeBar = function (x, y, onPick) {
        var cells = [];

        var redraw = function (value) {
          cells.forEach(function (cell) { cell.destroy(); });
          cells.length = 0;

          for (var i = 0; i < STEPS; i++) {
            (function (step) {
              var on = value > step / STEPS;
              var cell = scene.add.rectangle(x + step * STEP_X, y, 6, 10, on ? 0x48a038 : 0xb0a890)
                .setDepth(22)
                .setInteractive(new Phaser.Geom.Rectangle(-3, -5, 6, 10), Phaser.Geom.Rectangle.Contains);
              cell.on('pointerdown', function () {
                JA.audio.play('select');
                var picked = step / STEPS;
                onPick(picked);
                redraw(picked);
              });
              cells.push(cell);
            })(i);
          }
        };

        return redraw;
      };

      var musicBar = makeBar(150, 100, function (v) {
        JA.save.setMusicVolume(v);
        JA.audio.setMusicVolume(v);
      });
      musicBar(settings.music);

      var sfxBar = makeBar(150, 128, function (v) {
        JA.save.setSfxVolume(v);
        JA.audio.setSfxVolume(v);
        JA.audio.play('coin');
      });
      sfxBar(settings.sfx);

      // Back button.
      var back = this.add.rectangle(200, 168, 90, 20, 0xe8603c).setStrokeStyle(2, 0x8a2c14).setDepth(22);
      JA.font.text(this, 200, 168, 'VOLVER', { size: 1, originX: 0.5, originY: 0.5, tint: 0xffffff }).setDepth(23);
      back.setInteractive(new Phaser.Geom.Rectangle(-45, -10, 90, 20), Phaser.Geom.Rectangle.Contains);
      back.on('pointerdown', function () {
        JA.audio.play('back');
        scene.scene.restart();
      });
    },

    startLevel: function (levelNumber, elapsed) {
      JA.audio.play('confirm');
      this.scene.start('Game', { level: levelNumber, elapsed: elapsed || 0 });
    }
  });

  JA.scenes = JA.scenes || {};
  JA.scenes.Title = Title;
})(window.JA);
