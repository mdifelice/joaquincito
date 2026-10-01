/*
 * BootScene — builds everything shared, then hands over to the title screen.
 *
 * Nothing is loaded over the network: all art is generated into canvas textures
 * at startup, so `create()` is the only thing that has to run before the game
 * is playable. It must therefore stay fast, and it must never depend on a
 * scene that has not started yet.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var Boot = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function BootScene() {
      Phaser.Scene.call(this, { key: 'Boot' });
    },

    create: function () {
      // 1. Save data first: the title screen reads it as soon as it starts.
      JA.save.load();

      // 2. Font and art. The font is a bitmap font, so it has to exist before
      //    any scene tries to add a text object.
      JA.font.create(this);
      JA.sprites.createAll(this);
      JA.tiles.createShared(this);

      // The title and map screens show ground, so build one theme here. Each
      // level rebuilds these for its own theme when it starts; addCanvas
      // replaces the texture, so doing it twice is fine.
      JA.tiles.createForTheme(this, 'plaza');

      // 3. Animations, built from the strips made above.
      this.createAnimations();

      // 4. The first user gesture is the only chance to start Web Audio, since
      //    browsers refuse to make noise before one. The listeners live on the
      //    window so they survive the scene change below — see unlockOnInput.
      this.unlockOnInput();

      this.scene.start('Title');
    },

    createAnimations: function () {
      var anims = this.anims;

      // The run cycle lives in a single 36x16 strip, so one animation with a
      // frame width covers all three frames. The frame size has to be stated
      // explicitly: a plain image texture carries no atlas frame data, so
      // without it `generateFrameNumbers` would quietly return no frames.
      anims.create({
        key: 'player-run',
        frames: anims.generateFrameNumbers('spr-playerRun', {
          start: 0, end: 2, frameWidth: 12, frameHeight: 16
        }),
        frameRate: 12,
        repeat: -1
      });

      // Choco's two walk frames, in a 48x20 strip.
      anims.create({
        key: 'boss-walk',
        frames: anims.generateFrameNumbers('spr-bossWalk', {
          start: 0, end: 1, frameWidth: 24, frameHeight: 20
        }),
        frameRate: 6,
        repeat: -1
      });

      // Felipe's two walk frames, in a 36x22 strip.
      anims.create({
        key: 'felipe-walk',
        frames: anims.generateFrameNumbers('spr-felipeWalk', {
          start: 0, end: 1, frameWidth: 18, frameHeight: 22
        }),
        frameRate: 6,
        repeat: -1
      });

      // The street crowd. Each is a two-frame strip, so one frame width per
      // strip covers both frames. Cyclists pedal faster than walkers, dogs
      // trot, and the dog is the shortest sprite so its frame height is 12.
      var crowd = [
        { key: 'walker-walk', strip: 'spr-walkerWalk', w: 12, h: 16, rate: 8 },
        { key: 'cyclist-walk', strip: 'spr-cyclistWalk', w: 22, h: 18, rate: 14 },
        { key: 'dog-walk', strip: 'spr-dogWalk', w: 16, h: 12, rate: 10 }
      ];

      crowd.forEach(function (spec) {
        anims.create({
          key: spec.key,
          frames: anims.generateFrameNumbers(spec.strip, {
            start: 0, end: 1, frameWidth: spec.w, frameHeight: spec.h
          }),
          frameRate: spec.rate,
          repeat: -1
        });
      });

      // The three small enemies only have two frames each, stored as separate
      // textures rather than a strip. Phaser lets one animation mix texture
      // keys, so a pair is enough to make them hop, roll and buzz.
      var pairs = [
        { key: 'bird-hop', a: 'spr-birdA', b: 'spr-birdB', rate: 8 },
        { key: 'ball-spin', a: 'spr-ballA', b: 'spr-ballB', rate: 14 },
        { key: 'wasp-buzz', a: 'spr-waspA', b: 'spr-waspB', rate: 18 }
      ];

      pairs.forEach(function (spec) {
        anims.create({
          key: spec.key,
          frames: [{ key: spec.a }, { key: spec.b }],
          frameRate: spec.rate,
          repeat: -1
        });
      });
    },

    unlockOnInput: function () {
      // The hooks are installed on `window` by the audio module, not on this
      // scene. Scene-scoped listeners would be removed by the `scene.start()`
      // at the end of this very method, so the player's first click — which
      // happens on the title screen — would never unlock Web Audio and the game
      // would stay silent for the whole run.
      JA.audio.armGestureUnlock();
      JA.audio.playMusic('title');
    }
  });

  JA.scenes = JA.scenes || {};
  JA.scenes.Boot = Boot;
})(window.JA);
