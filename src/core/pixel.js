/*
 * pixel.js — low-level helpers for building pixel-art textures in code.
 *
 * Everything in this game is drawn at runtime: there are no PNG files anywhere.
 * We paint onto plain <canvas> elements (1 pixel = 1 canvas unit) and hand them
 * to Phaser as textures. Because the canvas is never scaled before it reaches
 * the GPU, and the game config sets pixelArt: true, the result stays crisp at
 * any zoom level.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var pixel = {};

  /**
   * Create an offscreen pixel canvas.
   * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
   */
  pixel.canvas = function (w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas: canvas, ctx: ctx };
  };

  /** Width of a char-grid sprite (the longest row). */
  pixel.gridWidth = function (rows) {
    var w = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].length > w) w = rows[i].length;
    }
    return w;
  };

  /**
   * Paint a char-grid sprite.
   *
   * `legend` maps a character to a CSS colour. Any character mapped to null or
   * missing from the legend is left transparent, which is what makes it easy to
   * sketch sprites with '.' for empty space.
   *
   * @param rows  array of equal-ish length strings, one per pixel row
   * @param legend  map of char -> colour string (e.g. { 'k': '#f0c090' })
   * @param ox,oy  top-left pixel offset inside the destination ctx
   */
  pixel.drawGrid = function (ctx, rows, legend, ox, oy) {
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x);
        if (ch === '.' || ch === ' ') continue;
        var colour = legend[ch];
        if (!colour) continue;
        ctx.fillStyle = colour;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  };

  /**
   * Register a canvas as a Phaser texture, replacing any previous one.
   * Phaser warns loudly if you add the same key twice, so we clear it first.
   */
  pixel.addCanvas = function (scene, key, canvas) {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    scene.textures.addCanvas(key, canvas);
    return key;
  };

  /**
   * Create a texture of the given size and let a draw function paint it.
   * @param drawFn  function (ctx, w, h) that paints 1:1 pixels
   */
  pixel.makeTexture = function (scene, key, w, h, drawFn) {
    var surface = pixel.canvas(w, h);
    drawFn(surface.ctx, w, h);
    return pixel.addCanvas(scene, key, surface.canvas);
  };

  /**
   * Create a texture whose exact size comes from a char-grid sprite.
   * This is the workhorse for character/enemy art.
   */
  pixel.makeGridTexture = function (scene, key, rows, legend) {
    var w = pixel.gridWidth(rows);
    var h = rows.length;
    return pixel.makeTexture(scene, key, w, h, function (ctx) {
      pixel.drawGrid(ctx, rows, legend, 0, 0);
    });
  };

  /**
   * Horizontally flip a registered texture and store it under a new key.
   * Used for enemies that must face left as well as right.
   */
  pixel.makeFlipped = function (scene, srcKey, dstKey) {
    var src = scene.textures.get(srcKey).getSourceImage();
    var surface = pixel.canvas(src.width, src.height);
    surface.ctx.translate(src.width, 0);
    surface.ctx.scale(-1, 1);
    surface.ctx.drawImage(src, 0, 0);
    return pixel.addCanvas(scene, dstKey, surface.canvas);
  };

  /**
   * Build a horizontal filmstrip texture from a list of char-grid frames.
   * Phaser animates from these with `frameWidth`.
   *
   * @param frames  array of char-grid arrays
   * @param legend  shared colour legend
   */
  pixel.makeStrip = function (scene, key, frames, legend) {
    var w = 0;
    var h = 0;
    for (var i = 0; i < frames.length; i++) {
      w = Math.max(w, pixel.gridWidth(frames[i]));
      h = Math.max(h, frames[i].length);
    }
    return pixel.makeTexture(scene, key, w * frames.length, h, function (ctx) {
      for (var f = 0; f < frames.length; f++) {
        pixel.drawGrid(ctx, frames[f], legend, f * w, 0);
      }
    });
  };

  /**
   * Cut a horizontal filmstrip texture into numbered sub-frames.
   *
   * `textures.addCanvas` only ever produces a single `__BASE` frame, and
   * `anims.generateFrameNumbers` skips any frame the texture does not already
   * contain — so a strip has to be sliced up like this before it can be
   * animated. Frame names are '0', '1', '2', ...
   *
   * @param count  number of frames laid side by side
   */
  pixel.addStripFrames = function (scene, key, frameWidth, frameHeight, count) {
    var texture = scene.textures.get(key);
    if (!texture) return [];

    var added = [];
    for (var i = 0; i < count; i++) {
      texture.add(i, 0, i * frameWidth, 0, frameWidth, frameHeight);
      added.push(i);
    }
    return added;
  };

  /* ------------------------------------------------------------------ */
  /* Small drawing primitives used by the tile/prop painters.            */
  /* ------------------------------------------------------------------ */

  pixel.rect = function (ctx, x, y, w, h, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  };

  /** Draw a 1px rectangle outline. */
  pixel.frame = function (ctx, x, y, w, h, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  };

  /** Filled circle, used for coins, ball projectiles and eyes. */
  pixel.circle = function (ctx, cx, cy, r, colour) {
    ctx.fillStyle = colour;
    for (var y = -r; y <= r; y++) {
      var span = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - span, cy + y, span * 2 + 1, 1);
    }
  };

  JA.pixel = pixel;
})(window.JA);
