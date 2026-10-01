/*
 * audio.js — all sound effects and music, synthesised with the Web Audio API.
 *
 * There are no audio files in this project. Every sound is generated from
 * oscillators and noise buffers at runtime, which keeps the game a pure
 * code-and-text download and means the music is infinitely looped with no
 * seam.
 *
 * Two things to know:
 *   1. Browsers block audio until the user interacts with the page, so the
 *      AudioContext is created lazily on the first key press / click (see
 *      `unlock`). Calling play() before that is a harmless no-op.
 *   2. Music uses a look-ahead scheduler (the standard "A Tale of Two Clocks"
 *      pattern): a coarse timer wakes up often and schedules notes slightly in
 *      the future onto the sample-accurate audio clock. Using setTimeout to
 *      play notes directly produces audible jitter, which is very noticeable on
 *      a chiptune.
 */
window.JA = window.JA || {};

(function (JA) {
  'use strict';

  var audio = {};

  var ctx = null;
  var master = null;      // everything -> destination
  var musicBus = null;    // music -> musicGain
  var sfxBus = null;      // effects -> sfxGain
  var noiseBuffer = null;

  // A track asked for before the context was allowed to make noise. It is
  // started as soon as the first gesture unlocks audio, so music never has to
  // be re-requested by whichever scene happened to ask for it first.
  var pendingMusic = null;

  var armGestureUnlock = {};

  var settings = { music: 0.5, sfx: 0.7 };

  /* ------------------------------------------------------------------ */
  /* Note helpers                                                       */
  /* ------------------------------------------------------------------ */

  var NOTE_OFFSETS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  /** 'A4' | 'C#5' | 'Eb3' -> frequency in Hz. */
  function freqOf(name) {
    var m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 0;
    var semi = NOTE_OFFSETS[m[1].toLowerCase()];
    if (m[2] === '#') semi += 1;
    if (m[2] === 'b') semi -= 1;
    var octave = parseInt(m[3], 10);
    var midi = (octave + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                              */
  /* ------------------------------------------------------------------ */

  function ensureContext() {
    if (ctx) return ctx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;

    ctx = new Ctor();

    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    musicBus = ctx.createGain();
    musicBus.gain.value = settings.music;
    musicBus.connect(master);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = settings.sfx;
    sfxBus.connect(master);

    // One second of white noise, reused by every percussive sound.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // `resume()` is asynchronous, so the context is still 'suspended' on the
    // line immediately after unlock() returns. Music requested during the first
    // gesture is therefore parked in `pendingMusic`, and without this it would
    // sit there forever — which is why the game could unlock successfully and
    // still be silent. Flushing it when the context really is running starts
    // the waiting music as soon as the browser lets sound through.
    ctx.onstatechange = function () {
      if (ctx.state === 'running' && pendingMusic) {
        var want = pendingMusic;
        pendingMusic = null;
        audio.playMusic(want);
      }
    };

    return ctx;
  }

  /**
   * Call from a real user gesture to satisfy autoplay policy.
   * Safe to call repeatedly.
   */
  audio.unlock = function () {
    var c = ensureContext();
    if (c && c.state === 'suspended') c.resume();
    if (c && c.state === 'running' && pendingMusic) {
      var want = pendingMusic;
      pendingMusic = null;
      audio.playMusic(want);
    }
  };

  /**
   * Arm the browser gesture requirement for the whole page.
   *
   * The first click a player makes is on the title screen, but the only place
   * that used to listen for it was BootScene — which calls `scene.start()` in
   * the same `create()` it attached the listener in, so Phaser removed the
   * listener before it could ever fire. The audio context was therefore never
   * resumed and the whole game was silent.
   *
   * So the hooks live on `window` and survive every scene change. They are
   * one-shot: once the context is running nothing else has to listen.
   */
  audio.armGestureUnlock = function () {
    if (armGestureUnlock.done) return;
    armGestureUnlock.done = true;

    var tryUnlock = function () {
      audio.unlock();
      audio.setMusicVolume(JA.save.getSettings().music);
      audio.setSfxVolume(JA.save.getSettings().sfx);

      if (audio.isRunning()) {
        window.removeEventListener('pointerdown', tryUnlock, true);
        window.removeEventListener('keydown', tryUnlock, true);
        window.removeEventListener('touchstart', tryUnlock, true);
      }
    };

    window.addEventListener('pointerdown', tryUnlock, true);
    window.addEventListener('keydown', tryUnlock, true);
    window.addEventListener('touchstart', tryUnlock, true);
  };

  /** True once the context exists and is actually producing sound. */
  audio.isRunning = function () {
    return !!ctx && ctx.state === 'running';
  };

  audio.setMusicVolume = function (v) {
    settings.music = clamp01(v);
    if (musicBus) musicBus.gain.value = settings.music;
  };

  audio.setSfxVolume = function (v) {
    settings.sfx = clamp01(v);
    if (sfxBus) sfxBus.gain.value = settings.sfx;
  };

  audio.getMusicVolume = function () { return settings.music; };
  audio.getSfxVolume = function () { return settings.sfx; };

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  /* ------------------------------------------------------------------ */
  /* Voices                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * A single pitched blip.
   * @param type  oscillator type: 'square' | 'triangle' | 'sawtooth' | 'sine'
   * @param slideTo  optional target frequency for a pitch sweep
   */
  function blip(freq, start, dur, type, gain, slideTo) {
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var env = ctx.createGain();

    osc.type = type || 'square';
    osc.frequency.setValueAtTime(Math.max(1, freq), start);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + dur);
    }

    // Short attack, exponential decay: the classic chiptune envelope.
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(env);
    env.connect(sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  /** A filtered noise burst: drums, impacts, splashes. */
  function noise(start, dur, gain, filterFreq, sweepTo) {
    if (!ctx || !noiseBuffer) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    if (sweepTo) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), start + dur);
    }
    filter.Q.value = 1.2;

    var env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(sfxBus);
    src.start(start);
    src.stop(start + dur + 0.02);
  }

  /* ------------------------------------------------------------------ */
  /* Sound effects                                                      */
  /* ------------------------------------------------------------------ */

  /*
   * Each effect is a short scheduled sequence. `t` is "now"; every voice is
   * placed relative to it, so effects can overlap without drifting.
   */
  var SFX = {
    jump: function (t) {
      blip(300, t, 0.14, 'square', 0.16, 620);
    },
    coin: function (t) {
      // The classic two-note "ping".
      blip(freqOf('B5'), t, 0.07, 'square', 0.16);
      blip(freqOf('E6'), t + 0.07, 0.22, 'square', 0.16);
    },
    stomp: function (t) {
      blip(420, t, 0.09, 'square', 0.2, 90);
      noise(t, 0.09, 0.14, 1800, 400);
    },
    bump: function (t) {
      blip(150, t, 0.07, 'square', 0.15, 90);
    },
    throwBall: function (t) {
      blip(700, t, 0.08, 'triangle', 0.12, 1100);
    },
    ballHit: function (t) {
      blip(500, t, 0.1, 'square', 0.16, 180);
    },
    hurt: function (t) {
      blip(360, t, 0.3, 'sawtooth', 0.16, 90);
    },
    die: function (t) {
      var notes = ['G4', 'E4', 'C4', 'G3'];
      notes.forEach(function (n, i) {
        blip(freqOf(n), t + i * 0.11, 0.14, 'square', 0.18);
      });
    },
    powerup: function (t) {
      var notes = ['C5', 'E5', 'G5', 'C6'];
      notes.forEach(function (n, i) {
        blip(freqOf(n), t + i * 0.06, 0.12, 'square', 0.16);
      });
    },
    checkpoint: function (t) {
      blip(freqOf('C5'), t, 0.1, 'triangle', 0.16);
      blip(freqOf('G5'), t + 0.1, 0.2, 'triangle', 0.16);
    },
    bossHit: function (t) {
      blip(200, t, 0.2, 'sawtooth', 0.2, 60);
      noise(t, 0.18, 0.16, 900, 200);
    },
    bossSlam: function (t) {
      noise(t, 0.3, 0.2, 500, 90);
      blip(110, t, 0.26, 'square', 0.16, 45);
    },
    bossRoar: function (t) {
      blip(160, t, 0.45, 'sawtooth', 0.2, 70);
      noise(t + 0.1, 0.35, 0.1, 700, 200);
    },
    levelClear: function (t) {
      // Short victory fanfare.
      var notes = ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'];
      notes.forEach(function (n, i) {
        blip(freqOf(n), t + i * 0.13, 0.2, 'square', 0.18);
      });
    },
    gameOver: function (t) {
      var notes = ['C5', 'A4', 'F4', 'C4'];
      notes.forEach(function (n, i) {
        blip(freqOf(n), t + i * 0.22, 0.3, 'triangle', 0.18);
      });
    },
    select: function (t) {
      blip(freqOf('E5'), t, 0.05, 'square', 0.14);
    },
    confirm: function (t) {
      blip(freqOf('C5'), t, 0.06, 'square', 0.15);
      blip(freqOf('G5'), t + 0.06, 0.14, 'square', 0.15);
    },
    back: function (t) {
      blip(freqOf('G5'), t, 0.05, 'square', 0.14);
      blip(freqOf('C5'), t + 0.05, 0.12, 'square', 0.14);
    },
    pause: function (t) {
      blip(freqOf('A4'), t, 0.08, 'triangle', 0.15);
    }
  };

  /**
   * Play a named sound effect.
   * Unknown names are ignored so callers can be sloppy safely.
   */
  audio.play = function (name) {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') return; // still waiting for a gesture
    var effect = SFX[name];
    if (effect) effect(ctx.currentTime + 0.001);
  };

  /* ------------------------------------------------------------------ */
  /* Music                                                              */
  /* ------------------------------------------------------------------ */

  /*
   * Tracks are arrays of 16th-note steps. A step is:
   *   'C5'  play that pitch
   *   '-'   sustain the previous note (for held chords)
   *   ' '   rest
   * Patterns loop forever, so `steps % 16 === 0` is a bar line and each track
   * is padded to a whole number of bars.
   */
  var TRACKS = {
    // Calm, welcoming — main menu.
    title: {
      tempo: 100,
      lead: ('E5 - G5 - A5 - - B5 - A5 - G5 - - ' +
             'D5 - F5 - G5 - - A5 - G5 - F5 - - ' +
             'E5 - G5 - C6 - - B5 - A5 - G5 - - ' +
             'C5 - E5 - G5 - - A5 - G5 - E5 - - ').split(/\s+/),
      bass: ('C3 - - - G2 - - - C3 - - - G2 - - - ' +
             'D3 - - - A2 - - - D3 - - - A2 - - - ' +
             'E3 - - - B2 - - - E3 - - - B2 - - - ' +
             'F3 - - - C3 - - - F3 - - - C3 - - - ').split(/\s+/),
      drums: 'k - - h k - - h k - - h k - h k - - h'.split(/\s+/)
    },

    // Bright and bouncy — normal level play.
    level: {
      tempo: 132,
      lead: ('C5 - E5 - G5 - E5 - F5 - A5 - G5 - E5 - ' +
             'D5 - F5 - A5 - F5 - G5 - C6 - B5 - G5 - ' +
             'E5 - G5 - C6 - B5 - A5 - G5 - E5 - D5 - ' +
             'C5 - E5 - G5 - A5 - G5 - E5 - C5 - - - ').split(/\s+/),
      bass: ('C3 C3 G2 G2 C3 C3 G2 G2 C3 C3 G2 G2 C3 C3 G2 G2 ' +
             'D3 D3 A2 A2 D3 D3 A2 A2 D3 D3 A2 A2 D3 D3 A2 A2 ' +
             'E3 E3 B2 B2 E3 E3 B2 B2 E3 E3 B2 B2 E3 E3 B2 B2 ' +
             'F3 F3 C3 C3 F3 F3 C3 C3 F3 F3 C3 C3 F3 F3 C3 C3').split(/\s+/),
      drums: 'k - h - k - h - k - h - k - h h k - h - h'.split(/\s+/)
    },

    // Tense and driving — the boss fight.
    boss: {
      tempo: 152,
      lead: ('A4 - A4 - C5 - A4 - E5 - D5 - C5 - B4 - ' +
             'A4 - A4 - C5 - A4 - E5 - F5 - E5 - D5 - ' +
             'G4 - G4 - B4 - G4 - D5 - C5 - B4 - A4 - ' +
             'A4 - C5 - E5 - A5 - G5 - E5 - D5 - A4 - ').split(/\s+/),
      bass: ('A2 A2 A2 A2 A2 A2 A2 A2 E2 E2 E2 E2 E2 E2 E2 E2 ' +
             'G2 G2 G2 G2 G2 G2 G2 G2 D2 D2 D2 D2 D2 D2 D2 D2 ' +
             'A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2 A2').split(/\s+/),
      drums: 'k k h - k k h h k k h - k k h h'.split(/\s+/)
    },

    // Short, and stops itself — the "you finished the game" fanfare.
    victory: {
      tempo: 120,
      once: true,
      lead: ('C5 E5 G5 C6 - - - G5 C6 - - - ' +
             'A5 C6 E6 - - - E6 - - - - - - ').split(/\s+/),
      bass: ('C3 - - - G2 - - - C3 - - - G2 - - - ' +
             'F3 - - - C3 - - - C3 - - - - - - ').split(/\s+/),
      drums: 'k - h - k - h - k - h h k - - - - - - - -'.split(/\s+/)
    }
  };

  var music = {
    name: null,
    step: 0,
    nextTime: 0,
    timer: null,
    stepDur: 0.125
  };

  var LOOKAHEAD = 0.15;   // seconds of audio scheduled in advance
  var TICK = 30;          // ms between scheduler wake-ups

  function scheduleStep(stepIndex, time) {
    var track = TRACKS[music.name];
    if (!track) return;

    var len = track.lead.length;
    var lead = track.lead[stepIndex % len];
    var bass = track.bass[stepIndex % track.bass.length];
    var drum = track.drums[stepIndex % track.drums.length];
    var dur = music.stepDur;

    if (lead && lead !== '-' && lead !== ' ') {
      // Slight detune plus a second voice gives the pulse a bit of width.
      musicBlip(freqOf(lead), time, dur * 0.92, 'square', 0.10);
      musicBlip(freqOf(lead), time, dur * 0.92, 'square', 0.04, 6);
    }

    if (bass && bass !== '-' && bass !== ' ') {
      musicBlip(freqOf(bass), time, dur * 0.85, 'triangle', 0.16);
    }

    if (drum === 'k') musicKick(time);
    if (drum === 'h') musicHat(time);
  }

  // Music voices are routed to musicBus, and start from an explicit time.
  function musicBlip(freq, start, dur, type, gain, detune) {
    var osc = ctx.createOscillator();
    var env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), start);
    if (detune) osc.detune.setValueAtTime(detune, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(env);
    env.connect(musicBus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function musicKick(time) {
    var osc = ctx.createOscillator();
    var env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.11);
    env.gain.setValueAtTime(0.22, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(env);
    env.connect(musicBus);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  function musicHat(time) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.06, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(filter);
    filter.connect(env);
    env.connect(musicBus);
    src.start(time);
    src.stop(time + 0.07);
  }

  function tick() {
    var track = TRACKS[music.name];
    if (!track || !ctx) return;

    var total = Math.max(track.lead.length, track.bass.length, track.drums.length);

    // 'victory' is a one-shot jingle: stop once it has played all its steps.
    if (track.once && music.step >= total) {
      audio.stopMusic();
      return;
    }

    while (music.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (music.step < total) {
        scheduleStep(music.step, music.nextTime);
      }
      music.nextTime += music.stepDur;
      music.step++;
    }
  }

  /**
   * Start (or switch to) a named track.
   *
   * Before the first gesture the request is remembered rather than dropped, so
   * whichever scene asks for music first (the title screen) does not have to
   * guess that audio will be unlocked a moment later.
   */
  audio.playMusic = function (name) {
    if (!TRACKS[name]) return;
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') {
      pendingMusic = name;
      return;
    }

    if (music.name === name && music.timer) return; // already playing

    audio.stopMusic();

    music.name = name;
    music.step = 0;
    music.stepDur = 60 / TRACKS[name].tempo / 4; // 16th notes
    music.nextTime = ctx.currentTime + 0.06;      // small lead-in
    music.timer = setInterval(tick, TICK);
    tick();
  };

  audio.stopMusic = function () {
    if (music.timer) {
      clearInterval(music.timer);
      music.timer = null;
    }
    music.name = null;
  };

  audio.currentMusic = function () { return music.name; };

  JA.audio = audio;
})(window.JA);
