// Stage 15: Headless Chrome Visual QA & Real Browser Frame-Time Benchmark for Underwater Ocean AAA Overhaul
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9277;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_stage15_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/stage15_underwater_ocean');
const ART_DIR = 'C:\\Users\\muhsi\\.gemini\\antigravity\\brain\\dfeca48b-1181-45fd-ae40-dd90997ab89c';

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
          this.consoleErrors.push(msg.params.args.map(a => a.value || a.description || '').join(' '));
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          const details = msg.params.exceptionDetails;
          this.consoleErrors.push(details.text + ' ' + (details.exception ? details.exception.description : ''));
        }
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve: res, reject: rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      });
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result ? res.result.value : undefined;
  }
  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const outPath = path.join(SHOTS_DIR, filename);
    fs.writeFileSync(outPath, buf);
    const artPath = path.join(ART_DIR, filename);
    fs.writeFileSync(artPath, buf);
    console.log(`Saved screenshot: ${outPath} & ${artPath} (${buf.length} bytes)`);
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  let chromeProc, client;
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    chromeProc = spawn(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${TEMP_DIR}`,
      GAME_URL
    ]);

    await sleep(2000);
    const version = await getJson(`http://127.0.0.1:${PORT}/json/version`);
    console.log('Chrome Debugger connected:', version.Browser);

    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false
    });

    for (let i = 0; i < 30; i++) {
      const ready = await client.evaluate(`typeof window.NY3D !== 'undefined' && !!window.NY3D.BIOME_3D`);
      if (ready) break;
      await sleep(200);
    }

    // 1. Verify all 4 Underwater Ocean Archetypes, Roadside Props, and Overhead Ocean Trench Arch
    const modelAudit = await client.evaluate(`(() => {
      const B = window.NY3D.BIOME_3D;
      const m = B.models;
      const arch0 = m.oceanBiomeLandmark(0, '#2dd4bf', '#00f0ff', false);
      const arch1 = m.oceanBiomeLandmark(1, '#2dd4bf', '#00f0ff', false);
      const arch2 = m.oceanBiomeLandmark(2, '#2dd4bf', '#00f0ff', false);
      const arch3 = m.oceanBiomeLandmark(3, '#2dd4bf', '#00f0ff', false);
      const prop0 = m.oceanRoadsideProp(0, -1, '#00f0ff', false);
      const prop1 = m.oceanRoadsideProp(1, 1, '#00f0ff', false);
      const arch = m.oceanTrenchArch(0, '#00f0ff', '#2dd4bf', false);
      return {
        colossusFaces: arch0.f.length,
        coralCathedralFaces: arch1.f.length,
        sunkenCitadelFaces: arch2.f.length,
        hydroChimneyFaces: arch3.f.length,
        depthBeaconFaces: prop0.f.length,
        pressureResonatorFaces: prop1.f.length,
        oceanArchFaces: arch.f.length
      };
    })()`);
    console.log('🌊 Stage 15 Underwater Ocean 3D Model Audit:', modelAudit);

    // 2. Capture Hero Shot 1: Same position as baseline (dist ~22m, high quality)
    await client.evaluate(`(() => {
      const g = window.NY3D;
      if (g.TUTORIAL_SYSTEM) g.TUTORIAL_SYSTEM.hideIntro();
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      const ld = document.getElementById('load');
      if (ld) { ld.classList.add('gone'); ld.style.display = 'none'; }
      g.G.quality = 'high';
      g.selectStartingBiome(6); // Biome 6: Underwater Ocean («ПОДВОДНЫЙ ОКЕАН»)
      g.startRun();
      g.G.invul = 999;
      for (let i = 0; i < 22; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(250);
    await client.screenshot('01_after_ocean_hero.png');

    // 3. Capture Shot 2: Approaching the overhead ocean trench arch spanning all 3 lanes
    await client.evaluate(`(() => {
      const g = window.NY3D;
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      for (let i = 0; i < 48; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(250);
    await client.screenshot('02_after_ocean_trench_arch.png');

    // 4. Measure Real Browser Frame-Time across High, Medium, and Low Quality Presets (180 frames each)
    const perfResults = await client.evaluate(`(() => {
      const g = window.NY3D;
      const results = {};
      for (const q of ['high', 'medium', 'low']) {
        g.G.quality = q;
        g.buildBackdrop();
        const t0 = performance.now();
        const frames = 180;
        for (let i = 0; i < frames; i++) {
          g.update(0.016);
          g.render();
        }
        const elapsed = performance.now() - t0;
        results[q] = {
          sceneryProps: g.G.scenery3D.length,
          totalMs: Number(elapsed.toFixed(2)),
          msPerFrame: Number((elapsed / frames).toFixed(3)),
          approxFps: Math.round(1000 / Math.max(0.1, elapsed / frames))
        };
      }
      g.G.quality = 'high';
      g.buildBackdrop();
      return results;
    })()`);
    console.log('⚡ Real Chrome Browser Frame-Time Benchmark in Underwater Ocean (180 frames per preset):', perfResults);

    // 5. Capture Shot 3: Mobile 320x568 viewport in Underwater Ocean
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 320, height: 568, deviceScaleFactor: 2, mobile: true
    });
    await client.evaluate(`(() => {
      const g = window.NY3D;
      if (g.TUTORIAL_SYSTEM) g.TUTORIAL_SYSTEM.hideIntro();
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      g.G.invul = 999;
      g.update(0.016);
      g.render();
    })()`);
    await sleep(250);
    await client.screenshot('03_after_ocean_mobile_320.png');

    // Check DOM layout overflow at 320px
    const overflowCheck = await client.evaluate(`(() => {
      return {
        docScrollW: document.documentElement.scrollWidth,
        docClientW: document.documentElement.clientWidth,
        bodyScrollW: document.body.scrollWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    })()`);
    console.log('📱 Mobile 320x568 Overflow Check:', overflowCheck);

    console.log('Console errors captured during test:', client.consoleErrors);
    if (client.consoleErrors.length > 0) {
      console.error('❌ Console errors encountered!');
    } else {
      console.log('✅ ZERO console errors encountered during entire Chrome test!');
    }

  } catch (err) {
    console.error('QA Test Error:', err);
  } finally {
    if (client) client.close();
    if (chromeProc) chromeProc.kill();
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch (e) {}
  }
}

run();
