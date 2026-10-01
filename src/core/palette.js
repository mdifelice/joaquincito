/*
 * palette.js — every colour in the game, in one place.
 *
 * The sprites below are defined with single-letter legend keys, so this file is
 * the only place that maps a letter to a real colour. That keeps the art files
 * readable as ASCII pictures and makes re-theming a one-line change.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  // Legend keys shared by the character/item sprites.
  var CHAR = {
    SKIN: '#f0c090',
    SKIN_DARK: '#c88050',
    BLUSH: '#e08878',

    HAIR: '#50301c',
    HAIR_LIGHT: '#8a5430',

    CAP: '#e03828',
    CAP_DARK: '#982018',

    SHIRT: '#f8d038',
    SHIRT_DARK: '#c89818',

    DENIM: '#3868c8',
    DENIM_DARK: '#203c80',

    SHOE: '#7a4520',
    SHOE_DARK: '#4a2810',

    EYE: '#181828',
    WHITE: '#f8f8f8',
    OUTLINE: '#181428',

    // Enemies
    BIRD_LIGHT: '#b8c4d8',
    BIRD_DARK: '#8894ac',
    BIRD_BEAK: '#f0a020',
    WASP_YELLOW: '#f8d838',
    WASP_BLACK: '#302820',
    WASP_BLUE: '#4878e0',

    // Boss (Choco the dog)
    DOG_LIGHT: '#d89850',
    DOG_DARK: '#a06828',
    DOG_BELLY: '#f0d0a0',

    // Items
    COIN: '#f8d038',
    COIN_DARK: '#b07818',
    COIN_LIGHT: '#fff0a0',
    HEART: '#e8384c',
    HEART_DARK: '#a01828',
    HEART_LIGHT: '#f88090',

    // Ball projectiles
    BALL: '#4878e0',
    BALL_LIGHT: '#90b8f8'
  };

  /*
   * Tile colours per level theme. A theme swaps these in so the same tile
   * painters produce a park, a street, a bridge, and so on.
   */
  var THEMES = {
    // 1. Plaza — bright midday, warm stone
    plaza: {
      sky: ['#68b8f8', '#a8dcf8'],
      groundTop: '#5cb838',
      groundTopDark: '#3c8a20',
      groundFill: '#b07840',
      groundFillDark: '#8a5828',
      stone: '#c8b8a0',
      stoneDark: '#9a8a74',
      accent: '#e8603c',
      prop: '#e8603c',
      cloud: '#f8f8f8',
      parallax: ['#a8dcf8', '#88c8e8', '#68b0d8']
    },
    // 2. Calle — asphalt road, kerbs, buildings
    calle: {
      sky: ['#78b0e8', '#b0d4f0'],
      groundTop: '#9a9aa8',
      groundTopDark: '#6e6e7c',
      groundFill: '#6e6e7c',
      groundFillDark: '#4e4e5a',
      stone: '#b0b0bc',
      stoneDark: '#80808c',
      accent: '#f0c020',
      prop: '#e0e0e8',
      cloud: '#f8f8f8',
      parallax: ['#b0d4f0', '#88b0d8', '#6a90c0']
    },
    // 3. Parque — grass, flowers, trees
    parque: {
      sky: ['#58c8e8', '#b0e8f0'],
      groundTop: '#48b028',
      groundTopDark: '#2c7a14',
      groundFill: '#7a9a40',
      groundFillDark: '#587028',
      stone: '#c0c0a0',
      stoneDark: '#94947c',
      accent: '#f06090',
      prop: '#e04848',
      cloud: '#f8f8f8',
      parallax: ['#b0e8f0', '#80d0e0', '#58b0c8']
    },
    // 4. Parque de juegos — pastel, bouncy
    juegos: {
      sky: ['#88b8f8', '#d0d8f8'],
      groundTop: '#e8a0c0',
      groundTopDark: '#c07898',
      groundFill: '#c8b0e0',
      groundFillDark: '#9880b8',
      stone: '#f0d0e0',
      stoneDark: '#c0a0b8',
      accent: '#f0e038',
      prop: '#60d8c0',
      cloud: '#f8f8f8',
      parallax: ['#d0d8f8', '#a8b0e8', '#8090d0']
    },
    // 5. Mercado — warm awnings, crates
    mercado: {
      sky: ['#f8b870', '#f8e0a8'],
      groundTop: '#d08850',
      groundTopDark: '#a06030',
      groundFill: '#a87848',
      groundFillDark: '#805830',
      stone: '#e0c8a0',
      stoneDark: '#b09870',
      accent: '#e03858',
      prop: '#50b878',
      cloud: '#fff0d0',
      parallax: ['#f8e0a8', '#f0c888', '#e0a868']
    },
    // 6. Puente — late afternoon over water
    puente: {
      sky: ['#4888d8', '#f8b878'],
      groundTop: '#c07848',
      groundTopDark: '#905028',
      groundFill: '#8a6038',
      groundFillDark: '#664020',
      stone: '#b89878',
      stoneDark: '#8a6c50',
      accent: '#f0f060',
      prop: '#60a0e0',
      cloud: '#ffe0c0',
      parallax: ['#f8b878', '#e08858', '#a86048']
    },
    // 7. Escaleras — dusk, long shadows
    atardecer: {
      sky: ['#6848a8', '#f08868'],
      groundTop: '#7868a8',
      groundTopDark: '#584878',
      groundFill: '#585068',
      groundFillDark: '#3c3848',
      stone: '#a898c0',
      stoneDark: '#786898',
      accent: '#ffd860',
      prop: '#f08868',
      cloud: '#f8c8b0',
      parallax: ['#f08868', '#b06098', '#684890']
    },
    // 8. Patio del colegio — morning, final block
    patio: {
      sky: ['#68c0f0', '#c0e8f8'],
      groundTop: '#4ca838',
      groundTopDark: '#2e7a1c',
      groundFill: '#c8b088',
      groundFillDark: '#9a8260',
      stone: '#dcd0b8',
      stoneDark: '#aca084',
      accent: '#e03828',
      prop: '#3878d0',
      cloud: '#f8f8f8',
      parallax: ['#c0e8f8', '#90c8e8', '#68a0d0']
    }
  };

  JA.palette = { char: CHAR, themes: THEMES };
})(window.JA);
