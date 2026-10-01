/*
 * tiles.js — terrain tiles, street props and background art.
 *
 * Unlike the characters (which are hand-drawn ASCII grids), tiles and props are
 * painted procedurally. Two reasons:
 *   1. Tiles must tile seamlessly, which is far easier to guarantee with loops
 *      than with a 16x16 ASCII sketch.
 *   2. Every level has a different theme, and procedural painters can be re-run
 *      per theme. `createForTheme` repaints the whole set using the colours in
 *      palette.js, so one code path produces eight distinct looks.
 *
 * Textures are named `tile-<name>` / `prop-<name>`.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var TILE = 16;

  /* ------------------------------------------------------------------ */
  /* Colour helpers                                                     */
  /* ------------------------------------------------------------------ */

  function toRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b]
      .map(function (v) {
        return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
      })
      .join('');
  }

  function lighten(hex, amount) {
    var c = toRgb(hex);
    return toHex(c.r + amount, c.g + amount, c.b + amount);
  }

  function darken(hex, amount) {
    var c = toRgb(hex);
    return toHex(c.r - amount, c.g - amount, c.b - amount);
  }

  /*
   * Note on transparency: fillRect with a fully transparent colour is a NO-OP
   * under source-over compositing — it does not erase. Anywhere a shape needs a
   * hole, the hole is left by simply not painting those pixels.
   */
  function fill(ctx, x, y, w, h, colour) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  /* ------------------------------------------------------------------ */
  /* Terrain                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Ground with a surface cap. `capRows` is the height of the surface layer, so
   * the tile directly under a surface tile can suppress its own cap.
   */
  function paintGround(ctx, theme, w, h, capRows) {
    capRows = capRows === undefined ? 5 : capRows;

    fill(ctx, 0, 0, w, h, theme.groundFill);

    // Deterministic speckle: a stable hash keeps the texture identical on
    // every reload, which matters because it is regenerated per level.
    for (var y = capRows; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (((x * 7 + y * 13) % 5) === 0) {
          fill(ctx, x, y, 1, 1, theme.groundFillDark);
        }
      }
    }

    if (capRows > 0) {
      fill(ctx, 0, 0, w, capRows - 1, theme.groundTop);
      fill(ctx, 0, capRows - 1, w, 1, theme.groundTopDark);

      // Grass blades hanging below the cap.
      for (var bx = 0; bx < w; bx += 2) {
        if ((bx * 3) % 5 !== 0) fill(ctx, bx, capRows, 1, 1, theme.groundTop);
      }
    }

    // Edge darkening gives the tile a little volume.
    fill(ctx, 0, capRows, 1, h - capRows, theme.groundFillDark);
    fill(ctx, w - 1, capRows, 1, h - capRows, theme.groundFillDark);
  }

  /** Plain solid block, used for walls. */
  function paintSolid(ctx, theme, w, h) {
    fill(ctx, 0, 0, w, h, theme.stone);
    fill(ctx, 0, 0, w, 2, lighten(theme.stone, 18));
    fill(ctx, 0, h - 2, w, 2, theme.stoneDark);
    fill(ctx, 0, 0, 1, h, lighten(theme.stone, 10));
    fill(ctx, w - 1, 0, 1, h, theme.stoneDark);

    // Half-offset brick bond reads better than a plain grid.
    var mid = Math.floor(h / 2);
    fill(ctx, 0, mid - 1, w, 1, theme.stoneDark);
    fill(ctx, w / 2 - 1, 0, 1, mid - 1, theme.stoneDark);
    fill(ctx, 0, mid, 1, h - mid, theme.stoneDark);
    fill(ctx, w - 1, mid, 1, h - mid, theme.stoneDark);
  }

  /* ------------------------------------------------------------------ */
  /* Texture creation                                                   */
  /* ------------------------------------------------------------------ */

  function tex(scene, prefix, key, w, h, paint) {
    JA.pixel.makeTexture(scene, prefix + key, w, h, function (ctx) {
      paint(ctx, w, h);
    });
  }

  /**
   * Build every terrain tile and pickup texture for one theme.
   * Called by GameScene so textures always match the level being played.
   */
  function createForTheme(scene, themeName) {
    var theme = JA.palette.themes[themeName] || JA.palette.themes.plaza;
    var T = TILE;
    var p = 'tile-';

    tex(scene, p, 'ground', T, T, function (ctx, w, h) { paintGround(ctx, theme, w, h, 5); });
    tex(scene, p, 'groundDeep', T, T, function (ctx, w, h) { paintGround(ctx, theme, w, h, 0); });
    tex(scene, p, 'solid', T, T, function (ctx, w, h) { paintSolid(ctx, theme, w, h); });
  }

  /**
   * Build the theme-independent art: props, backgrounds and UI icons.
   * Called once by BootScene, since none of it depends on the level theme.
   */
  function createShared(scene) {
    var p = 'prop-';
    var T = TILE;

    // --- School building: the goal at the end of the last cuadra -------
    // 48x40: walls, tiled roof, door, two windows and a sign.
    tex(scene, p, 'school', 48, 40, function (ctx, w, h) {
      fill(ctx, 0, 8, w, h - 8, '#d8b088');
      fill(ctx, 0, 8, w, 2, '#e8c8a0');
      fill(ctx, 0, h - 3, w, 3, '#8a6a48');

      // Roof, stepped so it reads as a shallow pitch.
      fill(ctx, 0, 4, w, 5, '#c03848');
      fill(ctx, 0, 4, w, 1, '#e05868');
      fill(ctx, 0, 8, w, 1, '#8a2030');
      fill(ctx, 2, 0, w - 4, 5, '#d04858');
      fill(ctx, 2, 0, w - 4, 1, '#f07080');
      fill(ctx, 6, 0, 3, 2, '#e8c850');

      // Windows
      [6, 34].forEach(function (x) {
        fill(ctx, x, 14, 8, 8, '#3878c8');
        fill(ctx, x, 14, 8, 1, '#f8f8f8');
        fill(ctx, x + 3, 14, 1, 8, '#f8f8f8');
        fill(ctx, x, 21, 8, 1, '#205090');
      });

      // Door
      fill(ctx, 20, 24, 9, 16, '#8a4a28');
      fill(ctx, 20, 24, 9, 1, '#a85c34');
      fill(ctx, 23, 24, 2, 16, '#6a3418');
      fill(ctx, 26, 32, 1, 1, '#f8d038');

      // Sign board
      fill(ctx, 14, 11, 20, 6, '#f8f0d0');
      fill(ctx, 14, 11, 20, 1, '#c8b890');
      fill(ctx, 16, 13, 16, 2, '#4878c8');
    });

    // --- Checkpoint flags ---------------------------------------------
    tex(scene, p, 'flagOff', 10, 24, function (ctx, w, h) {
      fill(ctx, 4, 0, 2, h, '#b0b0bc');
      fill(ctx, 4, 0, 1, h, '#d8d8e0');
    });

    tex(scene, p, 'flagOn', 10, 24, function (ctx, w, h) {
      fill(ctx, 4, 0, 2, h, '#b0b0bc');
      fill(ctx, 4, 0, 1, h, '#d8d8e0');
      fill(ctx, 0, 1, 4, 7, '#40c060');
      fill(ctx, 0, 1, 4, 1, '#80e890');
    });

    // --- Scenery -------------------------------------------------------
    tex(scene, p, 'tree', 32, 40, function (ctx, w, h) {
      fill(ctx, 14, 22, 4, h - 22, '#7a5020');
      fill(ctx, 14, 22, 1, h - 22, '#9a6c30');
      fill(ctx, 1, 12, 30, 9, '#2f8a34');
      fill(ctx, 3, 8, 26, 16, '#2f8a34');
      fill(ctx, 6, 5, 20, 5, '#3fa343');
      fill(ctx, 6, 5, 14, 2, '#63c46a');
      fill(ctx, 20, 18, 10, 5, '#23702a');
    });

    // A road sign on a post, 64x48. The name of the next cuadra is drawn on the
    // board by the scene, so the art is a plain board with room for text — no
    // arrow, which only fought the lettering.
    tex(scene, p, 'roadSign', 64, 48, function (ctx, w, h) {
      // Post.
      fill(ctx, 30, 26, 4, h - 26, '#7a5020');
      fill(ctx, 30, 26, 1, h - 26, '#9a6c30');

      // Board: green border, light interior, wide enough for the longest
      // cuadra name ("HOLMBERG", "TRONADOR") at the scene's text size.
      fill(ctx, 4, 2, w - 8, 24, '#3a6a48');
      fill(ctx, 5, 3, w - 10, 22, '#f8f8f8');
      fill(ctx, 4, 2, w - 8, 1, '#6aaa78');
    });

    // A parked car, 48x32: side view, facing left, standing on the kerb. This
    // is the tallest solid obstacle, so it is also the one worth saving a fire
    // flower for.
    tex(scene, p, 'car', 48, 32, function (ctx, w, h) {
      // Shadow under the body.
      fill(ctx, 2, h - 3, w - 4, 3, '#00000022');

      // Wheels, drawn first so the body overlaps their top half.
      fill(ctx, 6, h - 10, 10, 9, '#282828');
      fill(ctx, 8, h - 8, 6, 5, '#585858');
      fill(ctx, 32, h - 10, 10, 9, '#282828');
      fill(ctx, 34, h - 8, 6, 5, '#585858');

      // Lower body.
      fill(ctx, 3, 16, w - 6, h - 26, '#c03848');
      fill(ctx, 3, 16, w - 6, 2, '#e05868');
      fill(ctx, 3, h - 11, w - 6, 2, '#8a2030');

      // Cabin / greenhouse.
      fill(ctx, 12, 5, 22, 12, '#c03848');
      fill(ctx, 12, 5, 22, 1, '#e05868');

      // Windows.
      fill(ctx, 14, 7, 8, 8, '#a8d8f0');
      fill(ctx, 14, 7, 8, 2, '#c8e8f8');
      fill(ctx, 24, 7, 8, 8, '#a8d8f0');
      fill(ctx, 24, 7, 8, 2, '#c8e8f8');
      fill(ctx, 22, 6, 2, 10, '#8a2030');

      // Door seam and handle.
      fill(ctx, 21, 18, 1, h - 29, '#8a2030');
      fill(ctx, 19, 19, 3, 1, '#e05868');

      // Headlight and mirror.
      fill(ctx, w - 6, 19, 4, 4, '#f8e878');
      fill(ctx, 10, 15, 4, 2, '#8a2030');
    });

    tex(scene, p, 'bush', 20, 14, function (ctx, w, h) {
      fill(ctx, 1, 4, 18, 10, '#2f8a34');
      fill(ctx, 4, 1, 12, 4, '#3fa343');
      fill(ctx, 5, 2, 8, 2, '#63c46a');
    });

    tex(scene, p, 'lamp', 8, 40, function (ctx, w, h) {
      fill(ctx, 3, 6, 2, h - 6, '#585868');
      fill(ctx, 2, h - 2, 4, 2, '#484858');
      fill(ctx, 1, 0, 6, 7, '#484858');
      fill(ctx, 2, 1, 4, 5, '#f8e878');
      fill(ctx, 1, 6, 6, 1, '#383848');
    });

    tex(scene, p, 'hydrant', 10, 14, function (ctx, w, h) {
      fill(ctx, 3, 2, 4, h - 2, '#d83848');
      fill(ctx, 1, 4, 8, 3, '#d83848');
      fill(ctx, 3, 0, 4, 2, '#e85868');
      fill(ctx, 3, 4, 1, h - 6, '#f07080');
    });

    tex(scene, p, 'bin', 12, 16, function (ctx, w, h) {
      fill(ctx, 1, 2, 10, h - 2, '#4a8a58');
      fill(ctx, 0, 0, 12, 3, '#3a6a48');
      fill(ctx, 2, 3, 1, h - 5, '#6aaa78');
      fill(ctx, 5, 3, 1, h - 5, '#6aaa78');
    });

    // A row of houses, repeated horizontally for the mid-parallax band.
    tex(scene, p, 'houses', 160, 30, function (ctx, w, h) {
      // Ground line.
      fill(ctx, 0, h - 4, w, 4, '#c8d0b8');

      var i = 0;
      while (i < w + 32) {
        var roofH = 8;
        var houseW = 28 + ((i / 40) % 2) * 6;
        var x = i;
        var baseY = h - 4;
        // Body.
        fill(ctx, x + 2, baseY - 18, houseW - 4, 18, '#f0e0b8');
        // Roof.
        fill(ctx, x, baseY - 18 - roofH, houseW, roofH, '#b87040');
        fill(ctx, x, baseY - 18 - roofH, houseW, 2, '#d89060');
        // Windows.
        fill(ctx, x + 6, baseY - 14, 6, 6, '#a8d8f0');
        fill(ctx, x + 16, baseY - 14, 6, 6, '#a8d8f0');
        // Door.
        fill(ctx, x + houseW - 10, baseY - 12, 6, 12, '#8a6a40');
        i += houseW + 12;
      }
    });

    // --- Parallax layers -----------------------------------------------
    // Far hills. The sine period is 80px and the strip is 160px wide, so the
    // two humps line up exactly at the seam and the texture tiles invisibly.
    tex(scene, p, 'hills', 160, 60, function (ctx, w, h) {
      for (var x = 0; x < w; x++) {
        var t = (x % 80) / 80;
        var y1 = Math.round(34 - Math.sin(t * Math.PI) * 24);
        var t2 = ((x + 40) % 80) / 80;
        var y2 = Math.round(38 - Math.sin(t2 * Math.PI) * 16);
        var top = Math.min(y1, y2);
        for (var yy = top; yy < h; yy++) fill(ctx, x, yy, 1, 1, '#6a90b8');
        fill(ctx, x, top, 1, 2, '#7ea4c8');
      }
    });

    // Near buildings, for the street themes.
    tex(scene, p, 'buildings', 160, 56, function (ctx, w, h) {
      var heights = [30, 44, 24, 38, 48, 28, 42, 34];
      for (var b = 0; b < 8; b++) {
        var bw = 20;
        var bx = b * bw;
        var bh = heights[b];
        var by = h - bh;
        fill(ctx, bx, by, bw, bh, '#5a6a90');
        fill(ctx, bx, by, bw, 2, '#6e7ea4');
        for (var wy = by + 5; wy < h - 4; wy += 7) {
          for (var wx = bx + 3; wx < bx + bw - 4; wx += 6) {
            fill(ctx, wx, wy, 3, 4, '#f8e8a0');
          }
        }
      }
    });

    // Clouds: three overlapping puffs in a 48x16 strip.
    tex(scene, p, 'clouds', 48, 16, function (ctx, w, h) {
      var puffs = [[4, 9, 10], [11, 5, 12], [23, 7, 14], [33, 4, 11], [41, 8, 12]];
      puffs.forEach(function (pf) {
        JA.pixel.circle(ctx, pf[0], pf[1], Math.floor(pf[2] / 2), '#ffffff');
      });
      fill(ctx, 6, 11, 38, 3, '#ffffff');
      fill(ctx, 8, 10, 34, 1, '#f0f4ff');
    });

    // --- UI icons -------------------------------------------------------
    tex(scene, p, 'lock', 12, 14, function (ctx, w, h) {
      // Shackle built by omission: three bars, hole left unpainted.
      fill(ctx, 3, 0, 6, 2, '#c8ccd8');
      fill(ctx, 2, 1, 1, 5, '#c8ccd8');
      fill(ctx, 9, 1, 1, 5, '#c8ccd8');
      // Body
      fill(ctx, 1, 5, 10, 9, '#f0b020');
      fill(ctx, 1, 5, 10, 1, '#f8d048');
      fill(ctx, 1, 12, 10, 2, '#b07810');
      fill(ctx, 5, 8, 2, 3, '#7a4a08');
    });

    tex(scene, p, 'star', 9, 8, function (ctx) {
      JA.pixel.drawGrid(ctx, [
        '....y....',
        '....y....',
        '...yyy...',
        'yyyyyyyyy',
        '.yyyyyyy.',
        '..Yyyyy..',
        '..y...y..',
        '.yy...yy.'
      ], { y: '#f8d038', Y: '#fff0a0' }, 0, 0);
    });

    // Map nodes: completed / available / locked.
    tex(scene, p, 'nodeDone', 12, 12, function (ctx) {
      JA.pixel.circle(ctx, 6, 6, 5, '#2f8a34');
      JA.pixel.circle(ctx, 6, 6, 4, '#5fd06a');
      JA.pixel.circle(ctx, 5, 5, 2, '#a8f0b0');
    });
    tex(scene, p, 'nodeOpen', 12, 12, function (ctx) {
      JA.pixel.circle(ctx, 6, 6, 5, '#c83838');
      JA.pixel.circle(ctx, 6, 6, 4, '#f06060');
      JA.pixel.circle(ctx, 5, 5, 2, '#f8a0a0');
    });
    tex(scene, p, 'nodeLocked', 12, 12, function (ctx) {
      JA.pixel.circle(ctx, 6, 6, 5, '#585868');
      JA.pixel.circle(ctx, 6, 6, 4, '#787888');
    });

    // A plain white spark, tinted per particle for the end-of-run fireworks.
    tex(scene, p, 'spark', 3, 3, function (ctx, w, h) {
      fill(ctx, 1, 0, 1, 3, '#ffffff');
      fill(ctx, 0, 1, 3, 1, '#ffffff');
      fill(ctx, 1, 1, 1, 1, '#ffffff');
    });

    // An ice block, stretched over a frozen enemy. Translucent so the enemy
    // still reads through it, with a bright rim and a couple of glints.
    tex(scene, p, 'ice', 20, 20, function (ctx, w, h) {
      fill(ctx, 1, 1, w - 2, h - 2, '#a8e0f8dd');
      fill(ctx, 0, 0, w, 1, '#e8f8ff');
      fill(ctx, 0, 0, 1, h, '#e8f8ff');
      fill(ctx, w - 1, 0, 1, h, '#c8f0ff');
      fill(ctx, 0, h - 1, w, 1, '#c8f0ff');
      fill(ctx, 3, 3, 1, h - 9, '#ffffff');
      fill(ctx, w - 6, 4, 1, 5, '#f8ffff');
      fill(ctx, 4, h - 6, 6, 1, '#f8ffff');
    });
  }

  JA.tiles = {
    size: TILE,
    createForTheme: createForTheme,
    createShared: createShared,
    lighten: lighten,
    darken: darken
  };
})(window.JA);
