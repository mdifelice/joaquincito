/*
 * HudScene — lives, the 9:00 clock, and every full-screen panel.
 *
 * Runs as a separate scene on top of GameScene, so overlays can be shown and
 * hidden without touching the level, and pausing is just "stop simulating the
 * scene underneath".
 *
 * Everything here uses `setScrollFactor(0)`, because the level scrolls and the
 * HUD must not.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var Hud = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function HudScene() {
      Phaser.Scene.call(this, { key: 'Hud' });
    },

    init: function (data) {
      this.game$ = data.scene;
    },

    create: function () {
      this.buildBar();
      this.buildTouchPad();
      this.buildOverlays();

      // Escape is deliberately NOT handled here. GameScene owns the pause
      // toggle and calls showPause()/hidePause() itself; a second handler in
      // this scene would run straight afterwards and hide the panel that
      // GameScene had just opened, so the overlay would never appear.
    },

    /* ---------------------------------------------------------------- */
    /* Always-on bar                                                     */
    /* ---------------------------------------------------------------- */

    buildBar: function () {
      var level = this.game$.level;

      // A slim strip along the top, so it never hides much of the level.
      var bar = this.add.rectangle(200, 11, 400, 22, 0x000000, 0.45).setScrollFactor(0).setDepth(0);

      // Three columns that cannot collide. The title is centred and is by far
      // the widest of them (up to ~19 characters), so the side readouts are
      // pinned hard against the edges rather than floated in the middle.
      this.lifeIcon = this.add.image(11, 11, 'spr-heart').setScrollFactor(0).setDepth(1);
      this.lifeText = this.addCounter(20, 5, 'X3', 0xff8080);

      // Which power the player is holding, if any. Empty most of the time, so
      // it sits under the heart rather than taking more of the bar.
      this.powerText = JA.font.text(this, 22, 17, '', {
        size: 1, originX: 0, tint: 0xffe680
      }).setScrollFactor(0).setDepth(1);

      var title = JA.font.text(this, 200, 5, 'CUADRA ' + level.id + ' - ' + level.name, {
        size: 1, originX: 0.5, tint: 0xffffff
      }).setScrollFactor(0).setDepth(1);
      this.levelTitle = title;

      this.timeText = this.addCounter(392, 5, '9:00:00', 0xffffff, 1);

      // Full-screen toggle button (far left of HUD).
      var self = this;
      var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      this.fullscreenBtn = this.add.rectangle(50, 11, 30, 16, 0x000000, 0.4)
        .setStrokeStyle(1, 0xffffff, 0.7)
        .setScrollFactor(0)
        .setDepth(1)
        .setInteractive({ useHandCursor: true });

      // Show "F" key hint on desktop.
      var fsText = this.add.text(50, 11, isMobile ? '' : 'F', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(2);

      this.fullscreenBtn.on('pointerdown', function () {
        var promise = self.scale.isFullscreen ? self.scale.stopFullscreen() : self.scale.startFullscreen();
        if (promise && promise.catch) promise.catch(function () {});
      });
      self.scale.on('fullscreenchange', function () {
        fsText.setText(self.scale.isFullscreen ? (isMobile ? '' : 'F') : (isMobile ? '' : 'F'));
      });

      // On mobile, request fullscreen automatically after first user interaction.
      if (isMobile) {
        var requested = false;
        var requestFullscreen = function () {
          if (!requested && !self.scale.isFullscreen) {
            requested = true;
            var p = self.scale.startFullscreen();
            if (p && p.catch) p.catch(function () {});
          }
        };
        self.input.once('pointerdown', requestFullscreen);
        self.events.once('wake', requestFullscreen);
      }
    },

    /** A label whose value is rebuilt on demand, not every frame. */
    addCounter: function (x, y, initial, tint, originX) {
      var text = JA.font.text(this, x, y, initial, {
        size: 1,
        originX: originX === undefined ? 0 : originX,
        tint: tint,
        shadow: 0x000000
      }).setScrollFactor(0).setDepth(1);
      return text;
    },

    /* ---------------------------------------------------------------- */
    /* Touch controls                                                    */
    /* ---------------------------------------------------------------- */

    /**
     * On-screen buttons for players without a keyboard. They only appear once
     * a touch is seen, so a desktop player never sees clutter.
     */
    buildTouchPad: function () {
      var self = this;
      this.touchButtons = [];

      // Detect touch capability and show the pad immediately on touch devices
      // so buttons are visible without waiting for the first tap.
      var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouch) this.showTouchPad();

      this.input.on('pointerdown', function (pointer) {
        if (pointer.wasTouch) self.showTouchPad();
      });

      // Native touch events on canvas for true multi-touch (Phaser's pointer
      // system only tracks primary touch on some mobile browsers).
      var canvas = this.sys.game.canvas;
      this._nativeTouchHandler = function (e) {
        var touches = e.touches || e.changedTouches;
        var touch = self.game$ ? self.game$.touch : null;
        if (!touch) return;

        // Clear all touch flags first.
        touch.left = false;
        touch.right = false;
        touch.jump = false;
        touch.throw = false;

        for (var i = 0; i < touches.length; i++) {
          var t = touches[i];
          // Convert to Phaser's coordinate system (same as pointer.x/pointer.y)
          var rect = canvas.getBoundingClientRect();
          var scaleX = canvas.width / rect.width;
          var scaleY = canvas.height / rect.height;
          var x = (t.clientX - rect.left) * scaleX;
          var y = (t.clientY - rect.top) * scaleY;

          for (var j = 0; j < self.touchButtons.length; j++) {
            var btn = self.touchButtons[j];
            var bx = btn.box.x, by = btn.box.y;
            var bw = btn.box.width, bh = btn.box.height;
            if (x >= bx - bw / 2 && x <= bx + bw / 2 &&
                y >= by - bh / 2 && y <= by + bh / 2) {
              var action = btn.box.getData('action');
              if (action) touch[action] = true;
              btn.box.setFillStyle(0xffffff, 0.4);
              break;
            }
          }
        }

        // Update button visuals for buttons not currently pressed.
        for (var k = 0; k < self.touchButtons.length; k++) {
          var b = self.touchButtons[k];
          var act = b.box.getData('action');
          var isPressed = touch && touch[act];
          if (!isPressed) b.box.setFillStyle(0xffffff, 0.18);
        }

        // Prevent page scrolling while using controls
        e.preventDefault();
      };
      canvas.addEventListener('touchstart', self._nativeTouchHandler, { passive: false });
      canvas.addEventListener('touchmove', self._nativeTouchHandler, { passive: false });
      canvas.addEventListener('touchend', self._nativeTouchHandler, { passive: false });
      canvas.addEventListener('touchcancel', self._nativeTouchHandler, { passive: false });

      this.addTouchButton(16, 170, '<', 'left');
      this.addTouchButton(384, 170, '>', 'right');
      this.addTouchButton(200, 210, 'SALTO', 'jump');
      this.addTouchButton(360, 210, 'DISPARO', 'throw');
    },

    addTouchButton: function (x, y, label, action) {
      var self = this;
      var w;
      if (action === 'throw') w = 84;
      else w = action.length > 1 ? 64 : 54;
      var box = this.add.rectangle(x, y, w, 36, 0xffffff, 0.18)
        .setScrollFactor(0)
        .setStrokeStyle(1, 0xffffff, 0.4)
        .setDepth(2)
        .setVisible(false);

      var text = JA.font.text(this, x, y, label, {
        size: 1, originX: 0.5, originY: 0.5, tint: 0xffffff
      }).setScrollFactor(0).setDepth(3).setVisible(false);

      // Hit area handled by the global touchOverlay in update().
      // Disable individual interactivity to avoid multi-touch conflicts.
      // box.setInteractive(); // Disabled — handled by touchOverlay

      box.setData('action', action);
      this.touchButtons.push({ box: box, text: text });
      return box;
    },

    showTouchPad: function () {
      this.touchButtons.forEach(function (b) {
        b.box.setVisible(true);
        b.text.setVisible(true);
      });
    },

    /* ---------------------------------------------------------------- */
    /* Overlays                                                          */
    /* ---------------------------------------------------------------- */

    buildOverlays: function () {
      this.pausePanel = this.addPanel(0);
      this.clearPanel = this.addPanel(1);
      this.overPanel = this.addPanel(2);

      this.banner = JA.font.text(this, 200, 60, '', {
        size: 1, originX: 0.5, tint: 0xffffff, shadow: 0x1a3a68
      }).setScrollFactor(0).setDepth(31).setVisible(false);
    },

    /**
     * An empty, hidden full-screen panel to fill in when needed.
     *
     * The backdrop is deliberately NOT interactive. Phaser hit-tests the input
     * list in the order objects were registered, not in depth order, and every
     * backdrop is registered in buildOverlays() — long before the buttons that
     * appear on it. A full-screen interactive rectangle therefore sat at a lower
     * index than every panel button and swallowed each click, so no button on
     * the pause, level-clear or game-over panel could ever be pressed.
     *
     * Clicks on the empty part of a panel are swallowed a different way: each
     * panel installs a scene-level pointerdown handler that stops the pointer
     * from reaching the touch pad underneath (see showPanel).
     */
    addPanel: function (depth) {
      var backdrop = this.add.rectangle(200, 120, 400, 240, 0x101828, 0.82)
        .setScrollFactor(0)
        .setDepth(depth)
        .setVisible(false);

      // Card centered vertically with extra bottom padding (moved down 20px from center).
      // Height 176, so bottom at 120 + 176/2 + 20 = 228. Top at 228 - 176 = 52.
      // Center at y=140 gives bottom margin from screen edge.
      var card = this.add.rectangle(200, 140, 250, 176, 0xf8f0d0)
        .setScrollFactor(0)
        .setStrokeStyle(3, 0x8a5a28)
        .setDepth(depth + 10)  // Higher depth so level header never overlaps
        .setVisible(false);

      return { backdrop: backdrop, card: card, depth: depth, items: [] };
    },

    /** Clear a panel of everything drawn into it, then fill and show it. */
    showPanel: function (panel) {
      panel.items.forEach(function (item) { item.destroy(); });
      panel.items = [];
      panel.backdrop.setVisible(true);
      panel.card.setVisible(true);

      // The backdrop is not interactive (see addPanel), so clicks on the empty
      // part of a panel would otherwise fall through to the touch pad below it
      // and start the player walking while they are trying to read the panel.
      // The touch pad is switched off for as long as a panel is up.
      this.setTouchPadEnabled(false);
    },

    hidePanel: function (panel) {
      panel.backdrop.setVisible(false);
      panel.card.setVisible(false);
      panel.items.forEach(function (item) { item.destroy(); });
      panel.items = [];
      this.setTouchPadEnabled(true);
    },

    /** Turn the on-screen controls off while a panel is covering the screen. */
    setTouchPadEnabled: function (on) {
      if (!this.touchOverlay) return;
      this.touchOverlay.input.enabled = !!on;
      if (!on && this.game$) {
        var touch = this.game$.touch;
        touch.left = false;
        touch.right = false;
        touch.jump = false;
        touch.throw = false;
      }
    },

    /* ---------------------------------------------------------------- */
    /* Panel contents                                                    */
    /* ---------------------------------------------------------------- */

    showPause: function () {
      var self = this;
      var panel = this.pausePanel;

      this.showPanel(panel);

      // Card is centered at y=140 (height 176, so top=52, bottom=228).
      // Content depth must be above card's depth+10.
      var contentDepth = panel.depth + 11;

      panel.items.push(JA.font.text(this, 200, 86, 'PAUSA', {
        size: 3, originX: 0.5, tint: 0x30200c, shadow: 0xf8f0d0
      }).setDepth(contentDepth));

      // Controls live here, not only in the touch pad.
      [
        'MOVER    FLECHAS O A D',
        'SALTAR   W O ARRIBA',
        'DISPARAR ESPACIO O J'
      ].forEach(function (line, i) {
        panel.items.push(JA.font.text(this, 200, 122 + i * 15, line, {
          size: 1, originX: 0.5, tint: 0x6a5a40
        }).setDepth(contentDepth));
      }, this);

      panel.items.push(this.addPanelButton(panel, 200, 168, 'SEGUIR JUGANDO', function () {
        self.game$.togglePause();
      }));

      panel.items.push(this.addPanelButton(panel, 200, 194, 'REPETIR CUADRA', function () {
        self.hidePause();
        self.game$.clearPause();
        self.game$.restartLevel();
      }));

      panel.items.push(this.addPanelButton(panel, 200, 220, 'SALIR AL MAPA', function () {
        self.game$.clearPause();
        self.game$.goToMap();
      }));
    },

    hidePause: function () {
      this.hidePanel(this.pausePanel);
    },

    showLevelClear: function (isLast, timeMs, onTime) {
      var self = this;
      var panel = this.clearPanel;
      var level = this.game$.levelNumber;

      this.showPanel(panel);

      // After the fifth cuadra the run is judged, so the panel changes its
      // whole personality: the verdict is the headline, not a footnote.
      if (isLast) {
        // The run is over and it was won: the verdict is a celebration, not a
        // warning about the clock. A miss only changes the colour of the note.
        panel.items.push(JA.font.text(this, 200, 46, '¡FELICIDADES!', {
          size: 2, originX: 0.5, tint: 0xf0a018, shadow: 0x8a3a10
        }).setDepth(panel.depth + 0.2));

        panel.items.push(JA.font.text(this, 200, 72, 'LLEGASTE AL COLEGIO', {
          size: 1, originX: 0.5, tint: 0x30200c
        }).setDepth(panel.depth + 0.2));

        panel.items.push(JA.font.text(this, 200, 90, onTime ? 'A TIEMPO' : 'UN POCO TARDE', {
          size: 1, originX: 0.5, tint: onTime ? 0x2c7a20 : 0xc06010
        }).setDepth(panel.depth + 0.2));

        panel.items.push(JA.font.text(this, 200, 108, 'TIEMPO  ' + Math.floor(timeMs / 1000) + 'S', {
          size: 1, originX: 0.5, tint: 0x6a6a6a
        }).setDepth(panel.depth + 0.2));

        panel.items.push(this.addPanelButton(panel, 200, 146, 'VER EL MAPA', function () {
          self.game$.goToMap();
        }));

        panel.items.push(this.addPanelButton(panel, 200, 174, 'VOLVER A JUGAR', function () {
          self.game$.restartRun();
        }));

        this.celebrate(panel);
        return;
      }

      panel.items.push(JA.font.text(this, 200, 66, '¡BIEN HECHO!', {
        size: 2, originX: 0.5, tint: 0x2c7a20, shadow: 0xf8f0d0
      }).setDepth(panel.depth + 0.2));

      var best = JA.save.getLevelRecord(level).bestTimeMs;

      panel.items.push(JA.font.text(this, 200, 100, 'TIEMPO  ' + Math.floor(timeMs / 1000) + 'S', {
        size: 1, originX: 0.5, tint: 0x30200c
      }).setDepth(panel.depth + 0.2));

      if (best > 0) {
        panel.items.push(JA.font.text(this, 200, 118, 'MEJOR  ' + Math.floor(best / 1000) + 'S', {
          size: 1, originX: 0.5, tint: 0x6a6a6a
        }).setDepth(panel.depth + 0.2));
      }

      panel.items.push(this.addPanelButton(panel, 200, 158, 'SIGUIENTE CUADRA', function () {
        self.game$.continueFromOverlay();
      }));

      panel.items.push(this.addPanelButton(panel, 200, 188, 'AL MAPA', function () {
        self.game$.goToMap();
      }));
    },

    /**
     * A few firework bursts over the final panel, because reaching the school
     * should feel like winning rather than like another cuadra summary. The
     * emitter is stored in the panel's items so it is torn down with the rest.
     */
    celebrate: function (panel) {
      var self = this;
      var emitter = this.add.particles(0, 0, 'prop-spark', {
        lifespan: 900,
        speed: { min: 40, max: 140 },
        angle: { min: 200, max: 340 },
        gravityY: 110,
        scale: { start: 1.4, end: 0 },
        emitting: false,
        tint: [0xffd050, 0xff6060, 0x60c0ff, 0x80e060, 0xff80d0]
      })
        .setScrollFactor(0)
        .setDepth(panel.depth + 0.3);

      panel.items.push(emitter);

      for (var i = 0; i < 6; i++) {
        (function (n) {
          self.time.delayedCall(200 + n * 380, function () {
            if (!emitter.active) return;
            emitter.explode(24, Phaser.Math.Between(90, 310), Phaser.Math.Between(50, 150));
          });
        })(i);
      }
    },

    showGameOver: function () {
      var self = this;
      var panel = this.overPanel;

      this.showPanel(panel);

      panel.items.push(JA.font.text(this, 200, 76, 'SE TE ACABARON LOS VIDAS', {
        size: 2, originX: 0.5, tint: 0xa02020, shadow: 0xf8f0d0
      }).setDepth(panel.depth + 0.2));

      panel.items.push(JA.font.text(this, 200, 104, 'PRUEBA OTRA VEZ', {
        size: 1, originX: 0.5, tint: 0x30200c
      }).setDepth(panel.depth + 0.2));

      panel.items.push(this.addPanelButton(panel, 200, 140, 'OTRA VEZ', function () {
        self.game$.restartLevel();
      }));

      panel.items.push(this.addPanelButton(panel, 200, 170, 'AL MAPA', function () {
        self.game$.goToMap();
      }));
    },

    addPanelButton: function (panel, x, y, label, onClick, depthOffset) {
      if (depthOffset === undefined) depthOffset = 11;
      var w = Math.max(120, JA.font.measure(label, 1) + 20);

      var box = this.add.rectangle(x, y, w, 20, 0xe8603c)
        .setScrollFactor(0)
        .setStrokeStyle(2, 0x8a2c14)
        .setDepth(panel.depth + depthOffset);

      var text = JA.font.text(this, x, y, label, {
        size: 1, originX: 0.5, originY: 0.5, tint: 0xffffff
      }).setScrollFactor(0).setDepth(panel.depth + depthOffset + 0.05);

      box.setInteractive();
      box.input.cursor = 'pointer';
      box.on('pointerover', function () { box.setFillStyle(0xf8a040); });
      box.on('pointerout', function () { box.setFillStyle(0xe8603c); });
      box.on('pointerdown', function () {
        JA.audio.play('confirm');
        onClick();
      });

      // The label is part of the button, so it has to be torn down with it. It
      // used to be left behind: the box was destroyed on hide but its text was
      // not, so old labels piled up on later panels and their hover colours
      // were buried under stale text.
      panel.items.push(box);
      panel.items.push(text);

      return box;
    },

    showBanner: function (message) {
      var self = this;
      this.banner.setText(message).setVisible(true);

      this.time.delayedCall(1800, function () {
        self.banner.setVisible(false);
      });
    },

    /* ---------------------------------------------------------------- */
    /* Live values                                                       */
    /* ---------------------------------------------------------------- */

    /**
     * The run clock. The run starts at 9:00 and the whole thing has to be done
     * by 9:05, so the HUD counts real minutes forward from 9:00 and turns red
     * once 9:05 is on the clock.
     */
    sync: function () {
      var ms = this.game$ ? this.game$.elapsed : 0;
      var text = JA.save.clockLabel(ms);
      if (this.timeText.text !== text) {
        this.timeText.setText(text);
        // Red once 9:05 is on the clock: the deadline has passed.
        this.timeText.setTint(ms > JA.save.getRunLimit() ? 0xff6060 : 0xffffff);
      }
    },

    onLives: function () {
      this.lifeText.setText('X' + (this.game$ ? this.game$.lives : 0));
    },

    onPower: function () {
      var game = this.game$;
      if (!game) return;
      var label = game.power ? (game.power === 'fire' ? 'FUEGO  ESPACIO' : 'HIELO  ESPACIO') : '';
      if (this.powerText) this.powerText.text = label;
    },

    // Clean up native touch listeners on shutdown.
    shutdown: function () {
      if (this._nativeTouchHandler) {
        var canvas = this.sys.game.canvas;
        canvas.removeEventListener('touchstart', this._nativeTouchHandler);
        canvas.removeEventListener('touchmove', this._nativeTouchHandler);
        canvas.removeEventListener('touchend', this._nativeTouchHandler);
        canvas.removeEventListener('touchcancel', this._nativeTouchHandler);
      }
    }
  });

  JA.scenes = JA.scenes || {};
  JA.scenes.Hud = Hud;
})(window.JA);
