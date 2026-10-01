/*
 * font.js — a 5x7 pixel font, generated in code, with Spanish accents.
 *
 * Why a hand-built font instead of a browser font? Two reasons:
 *   1. A real monospace font is antialiased, so it would look smooth and modern
 *      next to chunky pixel sprites. Retro games shipped bitmap fonts.
 *   2. System fonts vary per machine; a generated font is identical everywhere.
 *
 * Each glyph is 5 wide and 7 tall, expressed as 7 numbers. A number encodes one
 * pixel row as a 5-bit mask, where the LEFTMOST pixel is bit 4 (value 16) and
 * the rightmost is bit 0 (value 1). So 0x0E (0b01110) is the three-pixel arch
 * that starts an 'A':
 *
 *      0b01110   .###.
 *      0b10001   #...#
 *      0b11111   #####
 *
 * Glyphs live in a 5x9 cell. Row 0 is left empty for the accent marks that
 * Spanish needs (Á É Í Ó Ú Ñ); rows 1-7 hold the letter itself. Unaccented
 * letters simply leave row 0 blank, so every glyph shares one baseline.
 *
 * The font is all-caps. That is a deliberate retro choice (many NES games had
 * no lowercase), and it means Spanish text needs uppercase accents only, which
 * keeps the glyph set small. Text is upper-cased automatically at draw time.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var GLYPH_W = 5;
  var GLYPH_H = 7;
  // Blank columns added to the right of every glyph. At zero the letters touch
  // and words turn into a solid block, so give each one a 1px gutter.
  var LETTER_SPACING = 1;
  var CELL_W = GLYPH_W + LETTER_SPACING;
  var CELL_H = 9; // 1 accent row + 7 letter rows + 1 breathing room
  var LETTER_Y = 1; // where the letter sits inside the cell
  var CHARS_PER_ROW = 16;

  /* Base glyphs, 7 rows of 5-bit masks. */
  var GLYPHS = {
    ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],

    A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
    C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
    D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
    E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
    F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
    G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
    H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
    I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
    J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
    K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
    L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
    M: [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11],
    N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
    O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
    Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
    R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
    S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
    T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
    U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
    V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
    W: [0x11, 0x11, 0x11, 0x11, 0x15, 0x1b, 0x11],
    X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
    Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
    Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],

    0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
    1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
    2: [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
    3: [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
    4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
    5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
    6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
    7: [0x1f, 0x01, 0x02, 0x04, 0x04, 0x08, 0x08],
    8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
    9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],

    '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
    '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
    '¿': [0x04, 0x00, 0x04, 0x08, 0x10, 0x11, 0x0e], // inverted ?
    '¡': [0x04, 0x00, 0x04, 0x04, 0x04, 0x04, 0x04], // inverted !
    '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
    ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c, 0x08],
    ':': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
    ';': [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x04, 0x08],
    '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
    '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
    '=': [0x00, 0x00, 0x1f, 0x00, 0x1f, 0x00, 0x00],
    '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
    '%': [0x19, 0x1a, 0x04, 0x08, 0x13, 0x0b, 0x00],
    '*': [0x00, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0x00],
    "'": [0x04, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00],
    '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
    ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
    '<': [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
    '>': [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
    '"': [0x0a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00],
    'x': [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11] // lowercase x, used for "3x"
  };

  /*
   * Accented capitals. Rather than redraw each letter, we keep the base glyph
   * and stamp a one-pixel accent into the spare top row of the cell.
   *   acute    ..##.  (leans up to the right)
   *   tilde    .#.#.  (the classic little wave)
   */
  var ACCENT_ACUTE = 0x06;
  var ACCENT_TILDE = 0x0a;

  var ACCENTED = {
    'Á': { base: 'A', accent: ACCENT_ACUTE },
    'É': { base: 'E', accent: ACCENT_ACUTE },
    'Í': { base: 'I', accent: ACCENT_ACUTE },
    'Ó': { base: 'O', accent: ACCENT_ACUTE },
    'Ú': { base: 'U', accent: ACCENT_ACUTE },
    'Ñ': { base: 'N', accent: ACCENT_TILDE }
  };

  // The atlas is laid out in this order; RetroFont maps characters by charCode.
  var CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ0123456789!.,:;?/%+-()¿¡*\'"<>x=';

  var FONT_KEY = 'pixel';
  var FONT_TEXTURE_KEY = 'font-atlas';

  /** Number of atlas rows needed. */
  function atlasRows() {
    return Math.ceil(CHARS.length / CHARS_PER_ROW);
  }

  /**
   * Paint one 5-bit mask row into the atlas context.
   * @param flipH  mirror the row, used to render 'right-facing' art
   */
  function paintMask(ctx, x, y, mask, colour, flipH) {
    ctx.fillStyle = colour;
    for (var col = 0; col < GLYPH_W; col++) {
      var bit = flipH ? GLYPH_W - 1 - col : col;
      if (mask & (1 << (GLYPH_W - 1 - bit))) {
        ctx.fillRect(x + col, y, 1, 1);
      }
    }
  }

  /**
   * Build the atlas texture and register it as a Phaser bitmap font.
   *
   * Phaser's RetroFont.Parse indexes glyphs by charCode and expects the atlas
   * to be a uniform grid, so we only need to guarantee that the Nth cell of the
   * atlas holds CHARS[N].
   */
  function create(scene, colour) {
    var rows = atlasRows();
    var surface = JA.pixel.canvas(CELL_W * CHARS_PER_ROW, CELL_H * rows);

    for (var i = 0; i < CHARS.length; i++) {
      var ch = CHARS.charAt(i);
      var cellX = (i % CHARS_PER_ROW) * CELL_W;
      var cellY = Math.floor(i / CHARS_PER_ROW) * CELL_H;

      var letter = null;
      var accent = null;

      if (ACCENTED[ch]) {
        letter = GLYPHS[ACCENTED[ch].base];
        accent = ACCENTED[ch].accent;
      } else if (GLYPHS[ch]) {
        letter = GLYPHS[ch];
      } else if (GLYPHS[ch.toUpperCase()]) {
        letter = GLYPHS[ch.toUpperCase()];
      }

      if (!letter) continue; // unknown char renders as blank

      if (accent !== null) {
        paintMask(surface.ctx, cellX, cellY, accent, colour, false);
      }

      for (var r = 0; r < GLYPH_H; r++) {
        paintMask(surface.ctx, cellX, cellY + LETTER_Y + r, letter[r], colour, false);
      }
    }

    JA.pixel.addCanvas(scene, FONT_TEXTURE_KEY, surface.canvas);

    var parsed = Phaser.GameObjects.RetroFont.Parse(scene, {
      image: FONT_TEXTURE_KEY,
      width: CELL_W,
      height: CELL_H,
      chars: CHARS,
      charsPerRow: CHARS_PER_ROW,
      offset: { x: 0, y: 0 },
      spacing: { x: 0, y: 0 },
      lineSpacing: 2
    });

    if (scene.cache.bitmapFont.exists(FONT_KEY)) {
      scene.cache.bitmapFont.remove(FONT_KEY);
    }
    scene.cache.bitmapFont.add(FONT_KEY, parsed);

    return FONT_KEY;
  }

  /**
   * Create a pixel-font text object.
   *
   * The font is all-caps, so text is upper-cased here. That keeps every call
   * site free of .toUpperCase() noise and guarantees consistency.
   *
   * @param opts  { size, colour/tint, origin, align, stroke }
   */
  function text(scene, x, y, str, opts) {
    opts = opts || {};
    var scale = opts.size || 1;

    var label = scene.add.bitmapText(x, y, FONT_KEY, String(str).toUpperCase());
    label.setScale(scale);
    label.setOrigin(
      opts.originX !== undefined ? opts.originX : 0,
      opts.originY !== undefined ? opts.originY : 0
    );
    if (opts.tint !== undefined) label.setTint(opts.tint);
    if (opts.alpha !== undefined) label.setAlpha(opts.alpha);
    if (opts.align) label.setAlign(opts.align);
    if (opts.shadow) {
      // Phaser 3.90 spells this `setDropShadow(x, y, colour, alpha)` on
      // BitmapText; there is no `setShadow` on that class.
      label.setDropShadow(1, 1, opts.shadow, 1);
    }
    return label;
  }

  /** Measure the pixel width a string will occupy at a given scale. */
  function measure(str, scale) {
    return String(str).length * CELL_W * (scale || 1);
  }

  JA.font = {
    key: FONT_KEY,
    chars: CHARS,
    glyphs: GLYPHS,
    accented: ACCENTED,
    cellW: CELL_W,
    cellH: CELL_H,
    lineHeight: CELL_H,
    create: create,
    text: text,
    measure: measure
  };
})(window.JA);
