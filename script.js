// ==========================================================================
// ELEMENTS & CONSTANTS
// ==========================================================================
const CANDLE_COUNT = 5;
const BIRTHDAY_AUDIO_SRC = "birthdaysex.mp3";

const candlesRow = document.getElementById("candles-row");
const blowHint = document.getElementById("blow-hint");
const cakeWrapper = document.getElementById("cake-wrapper");
const birthdayMessage = document.getElementById("birthday-message");

const cakeStage = document.getElementById("cake-stage");
const flowerStage = document.getElementById("flower-stage");
const toFlowerBtn = document.getElementById("to-flower-btn");
const backToCakeBtn = document.getElementById("back-to-cake-btn");
const paletteBtn = document.getElementById("palette-btn");
const replayBtn = document.getElementById("replay-btn");
const muteBtn = document.getElementById("mute-btn");
const micBtn = document.getElementById("mic-btn");

const statusToast = document.getElementById("status-toast");

let candlesLit = false;
let isMuted = false;
let assemblyTimers = [];
let toastTimer = null;

// Shared Web Audio Context & unlock state
let sfxAudioCtx = null;
let audioUnlocked = false;

// Birthday track & flower stage romantic instrumental state
let birthdayAudio = null;
let flowerMusicTimer = null;
let flowerMusicPlaying = false;

// Microphone state
let micActive = false;
let micStream = null;
let micAudioCtx = null;
let micRafId = null;

// ==========================================================================
// SOUND EFFECTS ENGINE (WEB AUDIO API)
// ==========================================================================
function unlockAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  if (!sfxAudioCtx) {
    sfxAudioCtx = new AudioCtx();
  }

  if (sfxAudioCtx.state === "suspended") {
    sfxAudioCtx
      .resume()
      .then(() => {
        audioUnlocked = sfxAudioCtx.state === "running";
      })
      .catch(() => {});
  } else if (sfxAudioCtx.state === "running") {
    audioUnlocked = true;
  }
}

function getAudioContext() {
  if (isMuted) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sfxAudioCtx) {
    sfxAudioCtx = new AudioCtx();
  }

  if (sfxAudioCtx.state !== "running") {
    sfxAudioCtx.resume().catch(() => {});
    return null;
  }

  audioUnlocked = true;
  return sfxAudioCtx;
}

function playLayerDropSound(stepIndex = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const baseFreq = 150 + stepIndex * 24;
  osc.type = "sine";
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.48, now + 0.09);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.14, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

function playBlowSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.36;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(950, now);
  filter.frequency.exponentialRampToValueAtTime(340, now + duration);
  filter.Q.value = 1.4;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration);
}

function playClickSound(freq = 587.33, duration = 0.08, volume = 0.08) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + duration);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

function playBloomChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const chord = [523.25, 659.25, 783.99, 1046.5];
  const start = ctx.currentTime + 0.04;

  chord.forEach((freq, idx) => {
    const t = start + idx * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.44);
  });
}

function stopBirthdayAudio() {
  if (birthdayAudio) {
    birthdayAudio.pause();
    birthdayAudio.currentTime = 0;
  }
}

function stopFlowerMusic() {
  flowerMusicPlaying = false;
  if (flowerMusicTimer) {
    clearTimeout(flowerMusicTimer);
    flowerMusicTimer = null;
  }
}

function startFlowerMusic() {
  stopFlowerMusic();
  if (isMuted) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  flowerMusicPlaying = true;

  // Gentle romantic progression (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
  const chords = [
    [174.61, 220.00, 261.63, 329.63],
    [164.81, 196.00, 246.94, 293.66],
    [146.83, 174.61, 220.00, 261.63],
    [130.81, 196.00, 246.94, 329.63],
  ];

  let step = 0;

  function playStep() {
    if (!flowerMusicPlaying || !flowerStage.classList.contains("active")) {
      stopFlowerMusic();
      return;
    }

    const activeCtx = getAudioContext();
    if (!activeCtx) {
      flowerMusicTimer = setTimeout(playStep, 450);
      return;
    }

    const chord = chords[Math.floor(step / 4) % chords.length];
    const noteFreq = chord[step % chord.length];
    const now = activeCtx.currentTime;

    const osc = activeCtx.createOscillator();
    const subOsc = activeCtx.createOscillator();
    const filter = activeCtx.createBiquadFilter();
    const gain = activeCtx.createGain();
    const subGain = activeCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(noteFreq, now);

    subOsc.type = "triangle";
    subOsc.frequency.setValueAtTime(step % 4 === 0 ? noteFreq * 0.5 : noteFreq * 2, now);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1150, now);

    subGain.gain.setValueAtTime(step % 4 === 0 ? 0.045 : 0.018, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

    osc.connect(filter);
    subOsc.connect(subGain);
    subGain.connect(filter);
    filter.connect(gain);
    gain.connect(activeCtx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 1.4);
    subOsc.stop(now + 1.4);

    step += 1;
    flowerMusicTimer = setTimeout(playStep, 520);
  }

  playStep();
}

// ==========================================================================
// TOAST HELPER
// ==========================================================================
function showToast(msg) {
  if (!statusToast) return;
  statusToast.textContent = msg;
  statusToast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    statusToast.classList.remove("show");
  }, 2600);
}

// ==========================================================================
// 1. BUILD CANDLES (WITH WICK, FLAME & SMOKE)
// ==========================================================================
function buildCandles() {
  candlesRow.innerHTML = "";
  for (let i = 0; i < CANDLE_COUNT; i++) {
    const candle = document.createElement("div");
    candle.className = "candle";

    const wick = document.createElement("span");
    wick.className = "wick";

    const flame = document.createElement("span");
    flame.className = "flame";

    const smoke = document.createElement("span");
    smoke.className = "smoke";

    candle.appendChild(wick);
    candle.appendChild(flame);
    candle.appendChild(smoke);
    candlesRow.appendChild(candle);
  }
}

// ==========================================================================
// 2. SEQUENTIAL CAKE ASSEMBLY (STEPS 1 -> 7, THEN STEP 8 CANDLES)
// ==========================================================================
function startCakeAssembly() {
  assemblyTimers.forEach(clearTimeout);
  assemblyTimers = [];
  candlesLit = false;
  stopConfetti();
  stopBirthdayAudio();

  blowHint.classList.add("hidden-hint");
  birthdayMessage.classList.remove("visible");
  candlesRow.classList.remove("built");

  const candleEls = document.querySelectorAll(".candle");
  candleEls.forEach((c) => c.classList.remove("blown"));

  for (let step = 1; step <= 7; step++) {
    const el = document.querySelector(`[data-step="${step}"]`);
    if (el) el.classList.remove("built");
  }

  for (let step = 1; step <= 7; step++) {
    const t = setTimeout(() => {
      const target = document.querySelector(`[data-step="${step}"]`);
      if (target) target.classList.add("built");
      playLayerDropSound(step);
    }, (step - 1) * 190);
    assemblyTimers.push(t);
  }

  const candleTimer = setTimeout(() => {
    candlesRow.classList.add("built");
    playLayerDropSound(8);
    candlesLit = true;
    blowHint.classList.remove("hidden-hint");
  }, 7 * 190 + 180);
  assemblyTimers.push(candleTimer);
}

// ==========================================================================
// 3. BLOW OUT CANDLES
// ==========================================================================
function blowOutCandles() {
  if (!candlesLit) return;
  candlesLit = false;

  unlockAudio();
  playBlowSound();

  cakeWrapper.classList.remove("puff");
  void cakeWrapper.offsetWidth;
  cakeWrapper.classList.add("puff");

  const candleEls = document.querySelectorAll(".candle");
  candleEls.forEach((candle, idx) => {
    setTimeout(() => {
      candle.classList.add("blown");
    }, idx * 75);
  });

  blowHint.classList.add("hidden-hint");

  setTimeout(() => {
    birthdayMessage.classList.add("visible");
    startConfetti();
    playBirthdayMelody();
  }, 360);
}

cakeWrapper.addEventListener("click", blowOutCandles);
cakeWrapper.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    blowOutCandles();
  }
});

// ==========================================================================
// 4. ASCII LILIES & MAJESTIC TWILIGHT SCENE (STAGE 2)
// ==========================================================================
const asciiLilies = (() => {
  const RAMP = " .:-=+*cxoaX#%&@";
  const WORLD_W = 1000;
  const WORLD_H = 1100;
  const FPS = 30;

  const PALETTES = [
    {
      name: "Pink Lilies",
      petal: "#f39ab2", edge: "#f9c3d2", blush: "#d99aa6", throat: "#c9dc78",
      vein: "rgba(170,40,80,0.45)", anther: "#4a1d10", spots: true,
    },
    {
      name: "White Oriental",
      petal: "#f6f2ea", edge: "#ffffff", blush: "#d8dcc0", throat: "#c8d87a",
      vein: "rgba(120,130,90,0.4)", anther: "#8a3a16", spots: false,
    },
    {
      name: "Mixed Garden",
      petal: ["#e3233a", "#d24aa9", "#f08a2a", "#e9c63c", "#f1e4c6", "#f39ab2"],
      edge: null, blush: "#c98a7a", throat: "#e8d070",
      vein: "rgba(80,10,20,0.45)", anther: "#3a160a", spots: true,
    },
  ];

  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (T, start, dur) => clamp((T - start) / dur, 0, 1);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (a, b, t) => {
    const x = clamp((t - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  };
  const rad = (d) => (d * Math.PI) / 180;

  function rgbOf(c) {
    if (c[0] === "#") {
      const n = parseInt(c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return c.match(/\d+/g).slice(0, 3).map(Number);
  }
  function mix(a, b, t) {
    const A = rgbOf(a), B = rgbOf(b);
    return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
  }
  function bez(p, t) {
    const u = 1 - t;
    return [
      u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
      u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
    ];
  }
  function bezAngle(p, t) {
    const a = bez(p, Math.max(0, t - 0.01)), b = bez(p, Math.min(1, t + 0.01));
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }

  let T = 0;
  function sway(x, y) {
    const lift = clamp((1090 - y) / 800, 0, 1);
    return [
      x + Math.sin(T * 0.9 + y * 0.006) * 8 * lift + Math.sin(T * 0.43 + x * 0.004) * 4 * lift,
      y,
    ];
  }

  const STEM_START = 0, STEM_DUR = 2.6;
  const LEAF_START = 1.0;
  const BUD_START = 2.2;
  const BLUSH_START = 3.6;
  const OPEN_START = 5.0, OPEN_GAP = 0.85, OPEN_DUR = 3.2;
  const RUSCUS_START = 0.6;
  const GYP_START = 2.4;

  function addFillers(S) {
    const r = rng(29);
    S.ruscus = [];
    S.gyp = [];

    const sprig = (base, ang, len, start, depth) => {
      const end = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
      const bend = (r() - 0.5) * len * 0.3;
      const pts = [
        base,
        [lerp(base[0], end[0], 0.33) + bend, lerp(base[1], end[1], 0.33)],
        [lerp(base[0], end[0], 0.7) + bend * 0.5, lerp(base[1], end[1], 0.7)],
        end,
      ];
      const leaves = [];
      for (let t = 0.2 + r() * 0.08, i = 0; t <= 1; t += 0.075 + r() * 0.035, i++) {
        leaves.push({ t, side: i % 2 ? 1 : -1, len: 34 + r() * 18, w: 10 + r() * 4, tint: r() });
      }
      leaves.push({ t: 1, side: 0, len: 46 + r() * 16, w: 11, tint: r() });
      S.ruscus.push({ pts, leaves, start });
      if (depth > 0) {
        for (let k = 0; k < 2; k++) {
          const t = 0.35 + r() * 0.35;
          const p = bez(pts, t);
          const side = k ? 1 : -1;
          sprig(p, ang + side * rad(25 + r() * 20), len * (0.4 + r() * 0.2), start + t * 1.4, depth - 1);
        }
      }
    };

    for (const end of [[210, 560], [270, 340], [420, 215], [600, 205], [750, 320], [810, 560]]) {
      const base = [490 + r() * 20, 820 - r() * 40];
      const ang = Math.atan2(end[1] - base[1], end[0] - base[0]);
      sprig(base, ang, Math.hypot(end[0] - base[0], end[1] - base[1]), RUSCUS_START + r() * 0.8, 0);
    }

    const clouds = [
      [340, 460], [660, 430], [500, 330], [280, 610], [740, 610],
      [450, 610], [590, 640], [400, 340], [620, 340], [520, 520],
    ];
    clouds.forEach(([cx, cy], ci) => {
      const base = [485 + r() * 30, 1000 + r() * 60];
      const start = GYP_START + ci * 0.12 + r() * 0.4;
      const outward = Math.atan2(cy - 620, cx - 500);
      const segs = [], flowers = [];
      const branch = (x, y, ang, len, depth, t) => {
        const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        segs.push({ x, y, x2, y2, t, w: 1.5 + depth * 0.8 });
        const t2 = t + 0.18;
        if (depth === 0) {
          flowers.push({ x: x2, y: y2, s: 4.5 + r() * 3.5, t: t2 + r() * 0.3, puffs: 2 + Math.floor(r() * 2) });
          return;
        }
        if (depth < 3 && r() < 0.75) flowers.push({ x: x2, y: y2, s: 3.5 + r() * 2.5, t: t2 + r() * 0.3, puffs: 1 });
        const kids = 2 + (r() < 0.45 ? 1 : 0);
        for (let k = 0; k < kids; k++) {
          const spread = rad(lerp(-70, 70, kids === 1 ? 0.5 : k / (kids - 1)) + (r() - 0.5) * 30);
          const target = lerp(ang + spread, outward, 0.25);
          branch(x2, y2, target, len * (0.4 + r() * 0.45), depth - 1, t2);
        }
      };
      const main = [
        [base[0], base[1]],
        [lerp(base[0], cx, 0.2), lerp(base[1], cy, 0.5)],
        [lerp(base[0], cx, 0.8), cy + 60],
        [cx, cy + 40],
      ];
      branch(cx, cy + 40, outward * 0.5 - Math.PI / 4, 40 + r() * 10, 4, 0.6);
      S.gyp.push({ main, segs, flowers, start, front: ci % 2 === 1 });
    });
  }

  function buildScene() {
    const r = rng(11);
    const S = { stems: [], leaves: [], buds: [] };

    const tops = [
      [310, 470, 2], [395, 360, 2], [500, 300, 3], [600, 350, 2],
      [700, 420, 2], [740, 500, 1], [350, 560, 1], [650, 560, 1],
    ];
    for (const [tx, ty, sides] of tops) {
      const bx = 485 + r() * 30;
      const stem = [[bx, 1090], [bx + (tx - bx) * 0.1, 860], [lerp(bx, tx, 0.7), ty + 220], [tx, ty]];
      const lean = (tx - 500) * 0.1;
      const stemRef = { pts: stem, start: STEM_START + r() * 0.4 };
      S.stems.push(stemRef);

      const n = 5 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const t = 0.22 + (i / n) * 0.5 + r() * 0.04;
        const side = i % 2 ? 1 : -1;
        S.leaves.push({
          stem, t, side, len: 85 + r() * 55, w: 13 + r() * 6,
          spread: rad(28 + r() * 26), start: LEAF_START + t * 1.5 + r() * 0.3, tint: r(),
        });
      }

      S.buds.push({ stem, stemRef, at: 1, ped: null, dir: rad(-90 + lean + (r() - 0.5) * 10) });
      for (let k = 0; k < sides; k++) {
        const side = k % 2 ? 1 : -1;
        const at = 0.82 + r() * 0.12;
        const base = bez(stem, at);
        const ang = rad(-90 + lean + side * (30 + r() * 25));
        const len = 40 + r() * 45;
        const end = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len];
        const ped = [
          base,
          [lerp(base[0], end[0], 0.3), base[1] - len * 0.35],
          [lerp(base[0], end[0], 0.8), lerp(base[1], end[1], 0.7)],
          end,
        ];
        S.buds.push({ stem, stemRef, at, ped, dir: ang });
      }
    }

    const order = S.buds.map((_, i) => i).sort(() => r() - 0.5);
    order.forEach((idx, rank) => {
      const b = S.buds[idx];
      b.len = 120 + r() * 40;
      b.width = 19 + r() * 5;
      b.squash = 0.6 + r() * 0.25;
      b.twist = (r() - 0.5) * 0.8;
      b.droop = rad((b.dir > rad(-90) ? 1 : -1) * (15 + r() * 20));
      b.colorIdx = rank;
      b.rnd = Array.from({ length: 12 }, r);
      b.grow = BUD_START + r() * 1.2;
      if (rank < 7) {
        b.maxOpen = 1; b.blush = 1; b.openAt = OPEN_START + rank * OPEN_GAP + r() * 0.3;
      } else if (rank < 11) {
        b.maxOpen = 0.08; b.blush = 0.8; b.openAt = OPEN_START + 2 + r() * 4;
      } else {
        b.maxOpen = 0; b.blush = 0.1 + r() * 0.2; b.openAt = Infinity; b.len *= 0.75;
      }
    });
    addFillers(S);
    return S;
  }

  function strokeCurve(g, pts, from, upto, width, color) {
    if (upto <= from) return;
    const N = 36;
    g.beginPath();
    for (let i = 0; i <= N; i++) {
      const p = bez(pts, lerp(from, upto, i / N));
      const q = sway(p[0], p[1]);
      i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]);
    }
    g.lineWidth = width;
    g.strokeStyle = color;
    g.lineCap = "round";
    g.stroke();
  }

  function stemProgress(st) {
    return easeInOut(prog(T, st.start, STEM_DUR));
  }

  function drawLeaf(g, lf) {
    const p = easeOut(prog(T, lf.start, 1.4));
    if (!p) return;
    const a = bez(lf.stem, lf.t);
    const [x, y] = sway(a[0], a[1]);
    const ang = bezAngle(lf.stem, lf.t) + lf.side * lf.spread * (0.4 + 0.6 * p);
    const L = lf.len * p, W = lf.w * (0.4 + 0.6 * p);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const bend = lf.side * L * 0.18;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -W, L * 0.7, -W * 0.8 + bend * 0.5, L, bend);
    g.bezierCurveTo(L * 0.7, W * 0.8 + bend * 0.5, L * 0.3, W, 0, 0);
    const grad = g.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, "#2e6e22");
    grad.addColorStop(0.5, lf.tint > 0.5 ? "#4c9a2e" : "#3f8a2a");
    grad.addColorStop(1, "#78bc44");
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = 5;
    g.stroke();
    g.strokeStyle = "rgba(20,60,15,0.8)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(L * 0.6, bend * 0.3, L * 0.95, bend * 0.95);
    g.stroke();
    g.restore();
  }

  function tepal(g, L, W, color, edge, throat, vein, open, curl, spots, rnd) {
    const rc = smooth(0.45, 1, open);
    const tipX = L * (1 - 0.12 * rc), tipY = curl * W * 1.6 * rc;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -W * 0.85, L * 0.72, -W * 1.05 + tipY * 0.3, tipX, tipY);
    g.bezierCurveTo(L * 0.72, W * 1.05 + tipY * 0.3, L * 0.3, W * 0.85, 0, 0);
    const grad = g.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, throat);
    grad.addColorStop(lerp(0.45, 0.22, open), color);
    grad.addColorStop(1, edge);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.65)";
    g.lineWidth = 6;
    g.stroke();
    g.strokeStyle = open > 0.2 ? vein : "rgba(40,70,20,0.55)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(L * 0.05, 0);
    g.quadraticCurveTo(L * 0.6, tipY * 0.2, tipX * 0.94, tipY * 0.9);
    g.stroke();
    if (spots && open > 0.6) {
      g.fillStyle = `rgba(110,15,40,${(open - 0.6) * 2})`;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(L * (0.18 + rnd[i] * 0.22), (rnd[i + 4] - 0.5) * W * 0.8, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  function budState(b) {
    const grow = easeOut(prog(T, b.grow, 2.2));
    const blush = smooth(0, 1, prog(T, BLUSH_START + (b.grow - BUD_START), 2.5)) * b.blush;
    const open = easeInOut(prog(T, b.openAt, OPEN_DUR)) * b.maxOpen;
    return { grow, blush, open };
  }

  function drawBud(g, b, pal) {
    const sp = stemProgress(b.stemRef);
    if (b.ped) {
      if (sp < b.at) return;
      const pp = easeOut(prog(T, b.stemRef.start + STEM_DUR * b.at, 1.0));
      strokeCurve(g, b.ped, 0, pp, 5, "#5f9a34");
      if (pp < 0.6) return;
    } else if (sp < 0.98) {
      return;
    }
    const { grow, blush, open } = budState(b);
    if (!grow) return;

    const base = b.ped ? b.ped[3] : bez(b.stem, 1);
    const [x, y] = sway(base[0], base[1]);
    const multi = Array.isArray(pal.petal);
    const petal = multi ? pal.petal[b.colorIdx % pal.petal.length] : pal.petal;
    const edge = pal.edge || mix(petal, "#ffffff", 0.25);

    const budCol = mix("#9cc63e", pal.blush, blush);
    const color = mix(budCol, petal, smooth(0.05, 0.45, open));
    const edgeCol = mix(mix("#b4d860", pal.blush, blush), edge, smooth(0.05, 0.45, open));
    const throat = mix("#8fbf3a", pal.throat, open);

    const L = b.len * (0.3 + 0.7 * grow) * (1 + 0.3 * open);
    const W = b.width * (0.6 + 0.4 * grow) * (1 + 1.4 * open);

    g.save();
    g.translate(x, y);
    g.rotate(b.dir + b.droop * open);
    g.scale(1, lerp(1, b.squash, open));
    g.fillStyle = "#5f9a34";
    g.beginPath();
    g.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.rotate(b.twist * open);
    for (const k of [3, 1, -1, 2, -2, 0]) {
      g.save();
      g.rotate(rad(k * 60) * open);
      const wob = 1 + (b.rnd[(k + 3) % 12] - 0.5) * 0.12 * open;
      tepal(g, L * wob, W, color, edgeCol, throat, pal.vein, open, k === 0 ? 0.3 : Math.sign(k) || 1, pal.spots, b.rnd);
      g.restore();
    }
    const st = smooth(0.55, 1, open);
    if (st > 0) {
      for (let i = 0; i < 6; i++) {
        const a = rad(-28 + i * 11);
        const l = L * 0.72 * st * (0.92 + b.rnd[i] * 0.16);
        g.strokeStyle = "#d6dca8";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(l * 0.5, a * l * 0.3, Math.cos(a) * l, Math.sin(a) * l);
        g.stroke();
        g.fillStyle = pal.anther;
        g.beginPath();
        g.ellipse(Math.cos(a) * l, Math.sin(a) * l, 11, 4.5, a + Math.PI / 2, 0, Math.PI * 2);
        g.fill();
      }
      const pl = L * 0.82 * st;
      g.strokeStyle = "#cfe0a0";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(pl, 0);
      g.stroke();
      g.fillStyle = "#86a83c";
      g.beginPath();
      g.arc(pl, 0, 7, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function leafShape(g, L, W, bend) {
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.25, -W, L * 0.7, -W * 0.8 + bend * 0.5, L, bend);
    g.bezierCurveTo(L * 0.7, W * 0.8 + bend * 0.5, L * 0.25, W, 0, 0);
  }

  function drawRuscus(g, S) {
    for (const sp of S.ruscus) {
      const p = easeOut(prog(T, sp.start, 2.2));
      if (!p) continue;
      strokeCurve(g, sp.pts, 0, p, 4, "#4f7a34");
      for (const lf of sp.leaves) {
        const lp = easeOut(prog(p, lf.t - 0.04, 0.22));
        if (!lp) continue;
        const a = bez(sp.pts, lf.t);
        const [x, y] = sway(a[0], a[1]);
        g.save();
        g.translate(x, y);
        g.rotate(bezAngle(sp.pts, lf.t) + lf.side * rad(38));
        const L = lf.len * lp, W = lf.w * lp;
        leafShape(g, L, W, lf.side * L * 0.08);
        const grad = g.createLinearGradient(0, -W, L, W);
        grad.addColorStop(0, lf.tint > 0.5 ? "#356a2c" : "#2c5f30");
        grad.addColorStop(0.55, lf.tint > 0.5 ? "#5aa046" : "#4c9240");
        grad.addColorStop(1, "#3a7436");
        g.fillStyle = grad;
        g.fill();
        g.strokeStyle = "rgba(0,0,0,0.6)";
        g.lineWidth = 4;
        g.stroke();
        g.strokeStyle = "rgba(150,190,110,0.5)";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(L * 0.85, lf.side * L * 0.06);
        g.stroke();
        g.restore();
      }
    }
  }

  function drawGyp(g, S, front) {
    for (const c of S.gyp) {
      if (c.front !== front) continue;
      const p = prog(T, c.start, 3.2);
      if (!p) continue;
      strokeCurve(g, c.main, 0, easeOut(Math.min(1, p * 3)), 3, "#6b8a4a");
      const local = p * 3.2 - 0.6;
      g.strokeStyle = "#6f8f50";
      for (const sg of c.segs) {
        const k = clamp((local - sg.t) / 0.25, 0, 1);
        if (!k) continue;
        const [x, y] = sway(sg.x, sg.y), [x2, y2] = sway(sg.x2, sg.y2);
        g.lineWidth = sg.w;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(lerp(x, x2, k), lerp(y, y2, k));
        g.stroke();
      }
      for (const f of c.flowers) {
        const k = easeOut(clamp((local - f.t) / 0.5, 0, 1));
        if (!k) continue;
        const [x, y] = sway(f.x, f.y);
        const tw = 0.88 + 0.12 * Math.sin(T * 2.5 + f.x * 0.3);
        g.fillStyle = `rgba(252,250,244,${tw})`;
        for (let i = 0; i < f.puffs; i++) {
          g.beginPath();
          g.arc(x + (i - (f.puffs - 1) / 2) * f.s * 0.9, y - (i % 2) * f.s * 0.6, f.s * k, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  function drawScene(g, S, pal) {
    drawRuscus(g, S);
    drawGyp(g, S, false);
    for (const st of S.stems) strokeCurve(g, st.pts, 0, stemProgress(st), 9, "#5a9a30");
    for (const lf of S.leaves) drawLeaf(g, lf);
    const sorted = S.buds.slice().sort((a, b) => budState(a).open - budState(b).open || (a.openAt - b.openAt || 0));
    for (const b of sorted) drawBud(g, b, pal);
    drawGyp(g, S, true);
  }

  const screen = document.getElementById("screen");
  const sctx = screen ? screen.getContext("2d") : null;
  const off = document.createElement("canvas");
  const octx = off.getContext("2d", { willReadFrequently: true });

  const skyRng = rng(2026);
  const stars = Array.from({ length: 110 }, () => ({
    x: skyRng(),
    y: skyRng() * 0.84,
    r: 0.7 + skyRng() * 1.8,
    phase: skyRng() * Math.PI * 2,
    speed: 0.9 + skyRng() * 2.1,
    hue: skyRng(),
  }));

  const fireflies = Array.from({ length: 28 }, () => ({
    bx: 0.12 + skyRng() * 0.76,
    by: 0.16 + skyRng() * 0.68,
    rx: 18 + skyRng() * 44,
    ry: 12 + skyRng() * 32,
    speed: 0.35 + skyRng() * 0.65,
    phase: skyRng() * Math.PI * 2,
    size: 1.6 + skyRng() * 2.4,
  }));

  let cols = 0, rows = 0, cellW = 0, cellH = 0, fontSize = 0, dpr = 1;
  const styleCache = new Map();
  function style(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    let s = styleCache.get(key);
    if (!s) {
      s = `rgb(${r},${g},${b})`;
      styleCache.set(key, s);
    }
    return s;
  }

  function resize() {
    if (!screen || !sctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    fontSize = clamp(Math.floor(Math.min(w / 100, h / 85)), 5, 11);
    sctx.font = `bold ${fontSize}px Menlo, Consolas, "DejaVu Sans Mono", monospace`;
    cellW = sctx.measureText("M").width || fontSize * 0.6;
    cellH = fontSize;
    screen.width = Math.floor(w * dpr);
    screen.height = Math.floor(h * dpr);
    cols = Math.max(1, Math.ceil(w / cellW));
    rows = Math.max(1, Math.ceil(h / cellH));
    off.width = cols;
    off.height = rows;
  }

  const S = buildScene();
  let palette = 0;
  let t0 = performance.now();
  let last = 0;

  function drawMajesticSky(ctx, w, h) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#050311");
    bg.addColorStop(0.45, "#15092b");
    bg.addColorStop(0.78, "#26103a");
    bg.addColorStop(1, "#090517");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const halo = ctx.createRadialGradient(w * 0.5, h * 0.42, 12, w * 0.5, h * 0.44, Math.max(w, h) * 0.56);
    halo.addColorStop(0, "rgba(255, 224, 178, 0.22)");
    halo.addColorStop(0.28, "rgba(244, 114, 182, 0.12)");
    halo.addColorStop(0.6, "rgba(109, 40, 217, 0.1)");
    halo.addColorStop(1, "rgba(5, 3, 17, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    for (const st of stars) {
      const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(T * st.speed + st.phase));
      const sx = st.x * w;
      const sy = st.y * h;
      ctx.fillStyle = st.hue > 0.65
        ? `rgba(254, 240, 138, ${(pulse * 0.85).toFixed(3)})`
        : st.hue > 0.3
          ? `rgba(251, 207, 232, ${(pulse * 0.75).toFixed(3)})`
          : `rgba(224, 231, 255, ${(pulse * 0.75).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const ff of fireflies) {
      const fx = ff.bx * w + Math.cos(T * ff.speed + ff.phase) * ff.rx;
      const fy = ff.by * h + Math.sin(T * ff.speed * 1.2 + ff.phase) * ff.ry;
      const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * 2.4 + ff.phase * 2));
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, ff.size * 5);
      fg.addColorStop(0, `rgba(255, 245, 190, ${(glow * 0.9).toFixed(3)})`);
      fg.addColorStop(0.4, `rgba(251, 191, 36, ${(glow * 0.35).toFixed(3)})`);
      fg.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, fy, ff.size * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(pal) {
    if (!screen || !sctx || !cols || !rows) return;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const aspect = cellH / cellW;
    const sx = Math.min(cols / WORLD_W, (rows * aspect) / WORLD_H) * 0.96;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = "#000";
    octx.fillRect(0, 0, cols, rows);
    octx.setTransform(sx, 0, 0, sx / aspect, (cols - WORLD_W * sx) / 2, (rows - (WORLD_H * sx) / aspect) / 2);

    drawScene(octx, S, pal);

    const data = octx.getImageData(0, 0, cols, rows).data;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMajesticSky(sctx, viewW, viewH);

    sctx.save();
    sctx.globalAlpha = 0.48;
    sctx.filter = `blur(${Math.round(cellH * 0.45)}px)`;
    sctx.imageSmoothingEnabled = true;
    sctx.drawImage(off, 0, 0, cols * cellW, rows * cellH);
    sctx.restore();

    sctx.textBaseline = "top";
    const n = RAMP.length - 1;
    const flick = Math.floor(T * 8);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const m = Math.max(r, g, b);
        if (m < 14) continue;
        const v = m / 255;
        const h = ((x * 73856093) ^ (y * 19349663) ^ (flick * 83492791)) >>> 0;
        const j = h % 7 === 0 ? (h & 8 ? 1 : -1) : 0;
        const idx = clamp(Math.round(Math.pow(v, 0.7) * n) + j, 1, n);
        const k = Math.min(1.25, (40 + 215 * v) / m);
        sctx.fillStyle = style(
          Math.min(255, (r * k) | 0) & 0xf8,
          Math.min(255, (g * k) | 0) & 0xf8,
          Math.min(255, (b * k) | 0) & 0xf8
        );
        sctx.fillText(RAMP[idx], x * cellW, y * cellH);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!flowerStage.classList.contains("active")) return;
    if (now - last < 1000 / FPS) return;
    last = now;
    T = (now - t0) / 1000;
    render(PALETTES[palette]);
  }

  function replay() {
    t0 = performance.now();
    T = 0;
  }

  function cyclePalette() {
    palette = (palette + 1) % PALETTES.length;
    replay();
    return PALETTES[palette].name;
  }

  window.addEventListener("resize", resize);
  if (screen) {
    screen.addEventListener("click", () => {
      unlockAudio();
      playClickSound(523.25, 0.08, 0.07);
      replay();
      showToast("Replaying lilies...");
    });
  }

  const q = new URLSearchParams(location.search);
  if (q.has("p")) palette = clamp(+q.get("p") | 0, 0, PALETTES.length - 1);
  if (q.has("t")) t0 = performance.now() - +q.get("t") * 1000;

  resize();
  requestAnimationFrame(frame);

  return { replay, cyclePalette, resize };
})();

// ==========================================================================
// STAGE NAVIGATION & REPLAY CONTROLS (INSTANT FULL-VIEW, NO SCROLL)
// ==========================================================================
replayBtn.addEventListener("click", () => {
  unlockAudio();
  playClickSound(523.25, 0.09, 0.08);
  if (flowerStage.classList.contains("active")) {
    flowerStage.scrollTop = 0;
    asciiLilies.replay();
    startFlowerMusic();
    showToast("Replaying lilies...");
  } else {
    cakeStage.scrollTop = 0;
    startCakeAssembly();
    showToast("Replaying cake...");
  }
});

toFlowerBtn.addEventListener("click", () => {
  unlockAudio();
  stopBirthdayAudio();
  playBloomChime();
  window.scrollTo(0, 0);
  cakeStage.scrollTop = 0;
  flowerStage.scrollTop = 0;
  cakeStage.classList.remove("active");
  flowerStage.classList.add("active");
  document.body.classList.add("garden-mode");
  stopConfetti();
  asciiLilies.resize();
  asciiLilies.replay();
  startFlowerMusic();
});

backToCakeBtn.addEventListener("click", () => {
  unlockAudio();
  playClickSound(440, 0.09, 0.08);
  stopFlowerMusic();
  window.scrollTo(0, 0);
  flowerStage.scrollTop = 0;
  cakeStage.scrollTop = 0;
  flowerStage.classList.remove("active");
  document.body.classList.remove("garden-mode");
  cakeStage.classList.add("active");
  if (!candlesLit) {
    startCakeAssembly();
  }
});

if (paletteBtn) {
  paletteBtn.addEventListener("click", () => {
    unlockAudio();
    playClickSound(659.25, 0.08, 0.08);
    const name = asciiLilies.cyclePalette();
    showToast(`Palette: ${name}`);
  });
}

// ==========================================================================
// 6. CONFETTI CANVAS
// ==========================================================================
const canvas = document.getElementById("confetti-canvas");
const ctx = canvas.getContext("2d");
let confettiPieces = [];
let confettiAnimId = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const CONFETTI_COLORS = ["#ff758f", "#fbbf24", "#34d399", "#60a5fa", "#c084fc", "#f97316"];

function createConfettiPiece(startY = -20) {
  return {
    x: Math.random() * canvas.width,
    y: startY,
    w: 7 + Math.random() * 6,
    h: 4 + Math.random() * 5,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    speedY: 1.5 + Math.random() * 2.4,
    driftX: (Math.random() - 0.5) * 1.4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.14
  };
}

function startConfetti() {
  if (confettiAnimId) return;
  confettiPieces = Array.from({ length: 120 }, () =>
    createConfettiPiece(Math.random() * -canvas.height)
  );
  animateConfetti();
}

function stopConfetti() {
  if (confettiAnimId) {
    cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
  }
  confettiPieces = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  confettiPieces.forEach((p, index) => {
    p.y += p.speedY;
    p.x += p.driftX + Math.sin(p.angle) * 0.65;
    p.angle += p.spin;

    if (p.y > canvas.height + 16) {
      confettiPieces[index] = createConfettiPiece(-16);
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  });

  confettiAnimId = requestAnimationFrame(animateConfetti);
}

// ==========================================================================
// 7. BIRTHDAY AUDIO & MUTE CONTROL
// ==========================================================================
muteBtn.addEventListener("click", () => {
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? "🔇 Muted" : "🔊 Sound On";
  muteBtn.classList.toggle("active", isMuted);
  if (isMuted) {
    stopBirthdayAudio();
    stopFlowerMusic();
  } else {
    unlockAudio();
    playClickSound(659.25, 0.09, 0.08);
    if (flowerStage.classList.contains("active")) {
      startFlowerMusic();
    }
  }
  showToast(isMuted ? "Sound muted" : "Sound enabled");
});

function playBirthdayMelody() {
  if (isMuted) return;

  if (!birthdayAudio) {
    birthdayAudio = new Audio(BIRTHDAY_AUDIO_SRC);
  }

  birthdayAudio.currentTime = 0;
  birthdayAudio.play().catch(() => {});
}

// ==========================================================================
// 8. MICROPHONE BLOW DETECTION
// ==========================================================================
function stopMic() {
  micActive = false;
  if (micRafId) {
    cancelAnimationFrame(micRafId);
    micRafId = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
  if (micAudioCtx) {
    micAudioCtx.close().catch(() => {});
    micAudioCtx = null;
  }
  micBtn.textContent = "🎤 Mic Off";
  micBtn.classList.remove("active");
}

micBtn.addEventListener("click", async () => {
  unlockAudio();

  if (micActive) {
    stopMic();
    playClickSound(440, 0.08, 0.07);
    showToast("Microphone turned off");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("Microphone is not supported in this browser");
    return;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micActive = true;
    micBtn.textContent = "🎤 Blow Ready";
    micBtn.classList.add("active");
    playClickSound(659.25, 0.09, 0.08);
    showToast("Blow gently into your mic to put out the candles");

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    micAudioCtx = new AudioCtx();
    const source = micAudioCtx.createMediaStreamSource(micStream);
    const analyser = micAudioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);

    function listenForBlow() {
      if (!micActive) return;
      analyser.getByteFrequencyData(freqData);
      const average = freqData.reduce((sum, v) => sum + v, 0) / freqData.length;

      if (average > 48 && candlesLit) {
        blowOutCandles();
      }
      micRafId = requestAnimationFrame(listenForBlow);
    }

    listenForBlow();
  } catch {
    stopMic();
    showToast("Microphone permission denied or unavailable");
  }
});

// ==========================================================================
// INITIALIZE
// ==========================================================================
function handleFirstGesture() {
  unlockAudio();
  window.removeEventListener("pointerdown", handleFirstGesture);
  window.removeEventListener("keydown", handleFirstGesture);
}

window.addEventListener("pointerdown", handleFirstGesture, { passive: true });
window.addEventListener("keydown", handleFirstGesture, { passive: true });

buildCandles();
startCakeAssembly();