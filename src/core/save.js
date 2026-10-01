/*
 * save.js — progress persistence in localStorage.
 *
 * What is stored:
 *   - which cuadras are unlocked and completed, with the best time on each
 *   - the 9:00-9:05 run clock, so the timer survives a trip through the map
 *   - music / sound volumes
 *   - the cuadra to resume on
 *
 * Robustness notes:
 *   * localStorage can throw on access, not just on write. Opening index.html
 *     straight from disk gives the page an opaque origin, and some browsers
 *     (and some privacy modes) refuse it entirely. Every access is therefore
 *     wrapped, and the module transparently falls back to an in-memory object
 *     so the game still runs — progress just is not kept between sessions.
 *   * Stored JSON is validated field by field on load. A half-written or
 *     hand-edited save must never be able to crash the game.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var STORAGE_KEY = 'joaquincito.save.v1';

  var memoryFallback = null;

  /** True when progress will actually survive closing the tab. */
  var storageWorks = (function () {
    try {
      var probe = '__ja_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  function defaults() {
    return {
      version: 2,
      unlocked: 1,          // highest cuadra the player may enter
      lastLevel: 1,
      levels: {},           // "3" -> { completed, bestTimeMs }
      // The 9:00-9:05 clock. `elapsedMs` is how far into the run we are, and
      // `active` is false when there is no run in progress (fresh save, or the
      // run has been judged).
      run: { elapsedMs: 0, active: false },
      settings: { music: 0.5, sfx: 0.7 }
    };
  }

  var data = defaults();

  /* ------------------------------------------------------------------ */
  /* Validation                                                         */
  /* ------------------------------------------------------------------ */

  function num(value, fallback, min, max) {
    var n = typeof value === 'number' ? value : parseFloat(value);
    if (!isFinite(n)) return fallback;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  }

  /**
   * How many cuadras the game has. Read lazily because save.js is parsed before
   * levels.js, but load() only ever runs once the whole bundle is in place.
   */
  function levelCount() {
    return (JA.levels && JA.levels.count) || 1;
  }

  /**
   * Coerce arbitrary parsed JSON into a valid save shape.
   * Anything unrecognised falls back to the default rather than being trusted.
   *
   * The cap at `count` also migrates an older eight-cuadra save: unlocking is
   * clamped to the five that exist now, and records for cuadras that no longer
   * exist are dropped rather than left to rot in storage.
   */
  function sanitise(raw) {
    var out = defaults();
    if (!raw || typeof raw !== 'object') return out;

    var count = levelCount();

    out.unlocked = Math.max(1, Math.min(count, Math.round(num(raw.unlocked, 1, 1, count))));
    out.lastLevel = Math.max(1, Math.min(count, Math.round(num(raw.lastLevel, 1, 1, count))));

    if (raw.levels && typeof raw.levels === 'object') {
      Object.keys(raw.levels).forEach(function (key) {
        var n = parseInt(key, 10);
        if (!(n >= 1 && n <= count)) return;              // a cuadra that no longer exists
        var entry = raw.levels[key];
        if (!entry || typeof entry !== 'object') return;
        out.levels[key] = {
          completed: entry.completed === true,
          bestTimeMs: num(entry.bestTimeMs, 0, 0)
        };
      });
    }

    if (raw.run && typeof raw.run === 'object') {
      out.run.elapsedMs = num(raw.run.elapsedMs, 0, 0);
      out.run.active = raw.run.active === true;
    }

    if (raw.settings && typeof raw.settings === 'object') {
      out.settings.music = num(raw.settings.music, 0.5, 0, 1);
      out.settings.sfx = num(raw.settings.sfx, 0.7, 0, 1);
    }

    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Load / save                                                        */
  /* ------------------------------------------------------------------ */

  function readRaw() {
    if (!storageWorks) return memoryFallback;
    try {
      var text = window.localStorage.getItem(STORAGE_KEY);
      return text ? JSON.parse(text) : null;
    } catch (err) {
      // Corrupt entry: discard it rather than leaving the player stuck.
      return null;
    }
  }

  function writeRaw(value) {
    memoryFallback = value;
    if (!storageWorks) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (err) {
      // Quota or permission failure mid-session: keep the in-memory copy.
      storageWorks = false;
    }
  }

  var save = {};

  /** Read the save file into memory. Call once during boot. */
  save.load = function () {
    data = sanitise(readRaw());
    return data;
  };

  /** Write the current state back to storage. */
  save.flush = function () {
    writeRaw(data);
  };

  save.get = function () {
    return data;
  };

  save.hasStorage = function () {
    return storageWorks;
  };

  /* ------------------------------------------------------------------ */
  /* Progress queries                                                   */
  /* ------------------------------------------------------------------ */

  save.isUnlocked = function (levelNumber) {
    return levelNumber <= data.unlocked;
  };

  save.isCompleted = function (levelNumber) {
    var entry = data.levels[String(levelNumber)];
    return !!(entry && entry.completed);
  };

  save.getLevelRecord = function (levelNumber) {
    return data.levels[String(levelNumber)] || { completed: false, bestTimeMs: 0 };
  };

  save.getLastLevel = function () {
    return data.lastLevel;
  };

  /**
   * Record a cleared cuadra. Keeps the best time for that cuadra and unlocks
   * the next one.
   * @returns {{firstClear: boolean, newBestTime: boolean}}
   */
  save.completeLevel = function (levelNumber, result) {
    result = result || {};
    var timeMs = Math.max(0, Math.round(num(result.timeMs, 0, 0)));

    var key = String(levelNumber);
    var entry = data.levels[key] || { completed: false, bestTimeMs: 0 };

    var firstClear = !entry.completed;
    var newBestTime = timeMs > 0 && (entry.bestTimeMs === 0 || timeMs < entry.bestTimeMs);

    entry.completed = true;
    if (newBestTime) entry.bestTimeMs = timeMs;
    data.levels[key] = entry;

    data.unlocked = Math.min(levelCount(), Math.max(data.unlocked, levelNumber + 1));

    save.flush();
    return { firstClear: firstClear, newBestTime: newBestTime };
  };

  /** Remember which cuadra the player was on, for the "continue" flow. */
  save.setLastLevel = function (levelNumber) {
    data.lastLevel = Math.max(1, Math.min(levelCount(), Math.round(levelNumber)));
    save.flush();
  };

  /* ------------------------------------------------------------------ */
  /* The 9:00 - 9:05 run clock                                            */
  /* ------------------------------------------------------------------ */

  /** How long one whole run is allowed to take: five cuadras, five minutes. */
  save.getRunLimit = function () {
    return (JA.levels && JA.levels.runMs) || 5 * 60 * 1000;
  };

  /**
   * Format a run time as the wall clock a child would read off a clock face:
   * 0 minutes spent shows 9:00:00, and 5 minutes spent shows 9:05:00, the
   * deadline. Seconds are included so the counter is visibly alive every
   * second rather than appearing to freeze between minute marks.
   *
   * This lives here, next to the run limit, because both the HUD and the map
   * show the time and the two must never disagree about it.
   */
  save.clockLabel = function (ms) {
    var total = Math.floor(Math.max(0, num(ms, 0, 0)) / 1000);
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return '9:' + ('0' + Math.min(minutes, 59)).slice(-2) + ':' + ('0' + seconds).slice(-2);
  };

  /** Start a fresh run. The clock goes back to 9:00. */
  save.beginRun = function () {
    data.run.elapsedMs = 0;
    data.run.active = true;
    save.flush();
  };

  /**
   * Advance the run clock. Deliberately does NOT write to storage: this is
   * called every frame, and localStorage cannot take that. The value is
   * flushed at the next cuadra boundary, which is the only moment a page
   * reload could plausibly lose more than a few seconds.
   */
  save.setRunTime = function (ms) {
    data.run.elapsedMs = Math.max(0, num(ms, 0, 0));
  };

  save.getRunTime = function () {
    return data.run.elapsedMs;
  };

  save.isRunActive = function () {
    return data.run.active === true;
  };

  /** The run is over (judged, or abandoned): forget the clock. */
  save.endRun = function () {
    data.run.elapsedMs = 0;
    data.run.active = false;
    save.flush();
  };

  /* ------------------------------------------------------------------ */
  /* Settings                                                           */
  /* ------------------------------------------------------------------ */

  save.getSettings = function () {
    return data.settings;
  };

  save.setMusicVolume = function (v) {
    data.settings.music = num(v, 0.5, 0, 1);
    save.flush();
  };

  save.setSfxVolume = function (v) {
    data.settings.sfx = num(v, 0.7, 0, 1);
    save.flush();
  };

  /* ------------------------------------------------------------------ */

  /** Wipe all progress. Used by the "start over" confirmation. */
  save.reset = function () {
    data = defaults();
    writeRaw(data);
  };

  JA.save = save;
})(window.JA);
