// Minimal browser shim: index.html dagi o'yin kodini Node'da ishga tushirib,
// xatolarni topish uchun test platformi (haqiqiy brauzer kerak emas).
const fs = require('fs');
const path = require('path');

function makeCtx(canvas) {
  const calls = { count: 0, fillText: 0 };
  const grad = () => ({ addColorStop() {} });
  const handler = {
    get(t, k) {
      if (k === 'canvas') return canvas;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return grad;
      if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (k === '__calls') return calls;
      if (k in t) return t[k];
      return (...a) => { calls.count++; };
    },
    set(t, k, v) { t[k] = v; return true; },
  };
  return new Proxy({ globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: '', shadowColor: '', shadowBlur: 0, lineCap: '', lineJoin: '', globalCompositeOperation: '' }, handler);
}

function makeEl(tag, id) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), id: id || '', className: '', dataset: {}, children: [],
    style: new Proxy({}, { get: (t, k) => t[k] ?? '', set: (t, k, v) => (t[k] = String(v), true) }),
    textContent: '', innerHTML: '', value: '', width: 300, height: 150,
    clientWidth: 1280, clientHeight: 720, offsetWidth: 1280, offsetHeight: 720,
    classList: (() => {
      const set = new Set();
      return {
        add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)),
        toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; on ? set.add(c) : set.delete(c); return on; },
        contains: (c) => set.has(c), _set: set,
      };
    })(),
    appendChild(n) { this.children.push(n); n.parentNode = this; return n; },
    append(...n) { this.children.push(...n); },
    removeChild(n) { const i = this.children.indexOf(n); if (i >= 0) this.children.splice(i, 1); return n; },
    remove() {}, setAttribute(k, v) { this.attrs[k] = v; if (k === 'id') this.id = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
    attrs: {}, addEventListener(t, fn, o) { (this._L[t] ||= []).push(fn); }, removeEventListener() {},
    _L: {}, dispatch(t, ev) { (this._L[t] || []).forEach((f) => f.call(this, ev)); },
    closest(sel) {
      if (sel.startsWith('.plate')) return this._plate || null;
      if (sel === '.skin-chip') return this._chip || null;
      if (sel === '.perm') return this._perm || null;
      return null;
    },
    querySelector(sel) { this._q ||= {}; if (!this._q[sel]) this._q[sel] = makeEl('span', String(sel)); return this._q[sel]; },
    querySelectorAll: () => [],
    getContext: () => makeCtx(null),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    focus() {}, blur() {}, click() { this.dispatch('click', { target: this, preventDefault() {}, stopPropagation() {} }); },
    toDataURL: () => 'data:image/png;base64,',
  };
  el.classList.remove('hidden');
  el.classList.add('hidden');
  return el;
}

function buildEnv(src) {
  const registry = new Map();
  const created = [];
  const get = (sel) => {
    if (!sel || typeof sel !== 'string') return makeEl('div');
    const key = sel.trim();
    if (!registry.has(key)) registry.set(key, makeEl('div', key.startsWith('#') ? key.slice(1) : key));
    return registry.get(key);
  };
  const listeners = {};
  const canvas = makeEl('canvas', 'gl');
  canvas.getContext = () => makeCtx(canvas);
  canvas.width = 1280; canvas.height = 720;
  registry.set('#gl', canvas); registry.set('canvas', canvas);

  const rafQueue = [];
  const win = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
    localStorage: (() => {
      const m = new Map();
      return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
    })(),
    AudioContext: class { constructor() { this.state = 'running'; this.destination = { connect() {} }; }
      createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
      createOscillator() { return { type: '', frequency: { value: 440, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {}, disconnect() {} }; }
      createBiquadFilter() { return { type: '', frequency: { value: 1000 }, Q: { value: 1 }, connect() {} }; }
      createBuffer() { return { getChannelData: () => new Float32Array(4096) }; }
      createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {} }; }
      resume() { return Promise.resolve(); }
      get currentTime() { return 0; } },
    webkitAudioContext: undefined,
    navigator: { vibrate: () => true, userAgent: 'node-harness', language: 'uz' },
    screen: { width: 1280, height: 720 },
    location: { href: 'file:///index.html', search: '', protocol: 'file:' },
    document: null, console,
    YaGames: undefined,
    dispatch: null,
  };
  const doc = {
    hidden: false, visibilityState: 'visible',
    documentElement: makeEl('html'), body: makeEl('body'), head: makeEl('head'), title: '',
    getElementById: (id) => get('#' + id),
    querySelector: (sel) => get(sel),
    querySelectorAll: (sel) => {
      if (sel === '.shipPrev') { const arr = [0, 1, 2].map((i) => { const e = makeEl('canvas'); e.dataset.id = String(i); e.getContext = () => makeCtx(e); e.width = 148; e.height = 104; return e; }); return arr; }
      if (sel === '.tab') return [];
      if (sel === '.upg') return [];
      return [];
    },
    createElement: (tag) => { const e = makeEl(tag); created.push(e); return e; },
    addEventListener: (t, fn) => { (listeners['doc:' + t] ||= []).push(fn); },
    removeEventListener: () => {},
    fonts: { ready: Promise.resolve() },
  };
  win.document = doc;
  win.dispatch = (t, ev) => { (listeners[t] || []).forEach((f) => f(ev || { type: t, key: '', preventDefault() {}, touches: [{ clientX: 100 }], gamma: 0 })); };
  const sandbox = {
    window: win, document: doc, navigator: win.navigator, localStorage: win.localStorage,
    requestAnimationFrame: win.requestAnimationFrame, cancelAnimationFrame: win.cancelAnimationFrame,
    setTimeout: win.setTimeout, clearTimeout: win.clearTimeout, setInterval: win.setInterval, clearInterval: win.clearInterval,
    performance: win.performance, matchMedia: win.matchMedia, AudioContext: win.AudioContext, devicePixelRatio: 1,
    innerWidth: 1280, innerHeight: 720, console, Math, JSON, Date, Object, Array, Map, Set, String, Number, Boolean, Error, Promise, Uint8ClampedArray, Float32Array, Intl, isNaN, parseFloat, parseInt,
  };
  sandbox.globalThis = sandbox;
  win.globalThis = sandbox;
  return { sandbox, win, doc, canvas, listeners, registry, rafQueue };
}

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((b) => !/src=/.test(b[1]) && b[2].length > 1000);
if (!m.length) throw new Error('script topilmadi');
const vm = require('vm');
const env = buildEnv();
const ctxv = vm.createContext(env.sandbox);
const results = [];
function run(label, code) {
  try { return vm.runInContext(code, ctxv, { filename: 'game.js' }); }
  catch (e) { results.push('FAIL [' + label + ']: ' + e.message + ' >> ' + String(e.stack || '').split('\n').slice(1, 7).join(' | ')); return null; }
}


run('load', m[0][2]);
env.sandbox.NY3D = env.win.NY3D;
module.exports = { vm, ctxv, results, run, env, sandbox: env.sandbox, win: env.win, doc: env.doc, canvas: env.canvas, registry: env.registry, listeners: env.listeners };
