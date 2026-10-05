/*
 * game.js — entry point.
 *
 * Loaded last, after every core module and scene class has been defined, so it
 * can just read them off the global `JA` namespace and hand the classes to
 * Phaser.
 *
 * Classic scripts (no ES modules) are used throughout so the game also runs by
 * double-clicking index.html, where `file://` blocks module loading.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var WIDTH = 400;
  var HEIGHT = 240;

  var config = {
    type: Phaser.AUTO,

    // The canvas is a fixed 400x240 pixel-art stage. Scale.FIT then scales that
    // whole stage up to whatever the window is, keeping every pixel square.
    parent: 'game',
    width: WIDTH,
    height: HEIGHT,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    backgroundColor: '#101828',

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // On mobile, force landscape so the HUD and touch pad are always usable.
      orientation: Phaser.Scale.Orientation.LANDSCAPE,
      expandParent: true
    },

    // Arcade physics, tuned for small chunky tiles: enough gravity to feel
    // weighty, a floaty jump arc, and no pixel-perfect collision so that moving
    // past a corner never snags the player.
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 900 },
        tileBias: 24,
        fps: 60
      }
    },

    // Scenes are started explicitly, not auto-started, so nothing runs before
    // BootScene has built the shared textures.
    scene: []
  };

  JA.config = config;
  JA.WIDTH = WIDTH;
  JA.HEIGHT = HEIGHT;

  config.scene = [
    JA.scenes.Boot,
    JA.scenes.Title,
    JA.scenes.Map,
    JA.scenes.Game,
    JA.scenes.Hud
  ];

  JA.game = new Phaser.Game(config);
})(window.JA);
