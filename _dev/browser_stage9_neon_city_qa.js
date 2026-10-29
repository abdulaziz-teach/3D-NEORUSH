// Stage 9: Headless Chrome Visual QA & Real Browser Frame-Time Benchmark for Neon City AAA Overhaul
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9349;
const SHOTS_DIR = path.join(__dirname, 'shots', 'stage9_neon_city');

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
    this.id = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve: res, reject: rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const details = msg.params.exceptionDetails;
          this.consoleErrors.push(details.text + ' ' + (details.exception ? details.exception.description : ''));
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ': ' + (res.exceptionDetails.exception ? res.exceptionDetails.exception.description : ''));
    }
    return res.result ? res.result.value : undefined;
  }
  async screenshot(filename) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SHOTS_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log('📸 Captured screenshot:', outPath);
    return outPath;
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runStage9QA() {
  const fileUrl = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  const userDataDir = path.join(__dirname, 'temp_chrome_stage9_' + Date.now());

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,720',
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-file-access-from-files',
    fileUrl
  ], { stdio: 'ignore' });

  let client = null;
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(350);
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length > 0) break;
      } catch {}
    }
    if (!targets || !targets.length) throw new Error('Could not connect to Chrome targets');
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];

    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false
    });

    await sleep(1200);

    // 1. Verify all 4 Neon City Skyscraper Variants, Streetlamp, Overhead Gantry & Spinner
    const modelAudit = await client.evaluate(`(() => {
      const B = window.NY3D.BIOME_3D;
      const m = B.models;
      const t0 = m.citySkyscraper(0, '#00e5ff', '#ff2fb9', false);
      const t1 = m.citySkyscraper(1, '#00e5ff', '#ff2fb9', false);
      const t2 = m.citySkyscraper(2, '#00e5ff', '#ff2fb9', false);
      const t3 = m.citySkyscraper(3, '#00e5ff', '#ff2fb9', false);
      const lamp = m.cityStreetLamp(-1, '#00e5ff', '#ff2fb9', false);
      const gantry = m.cityOverheadGantry(1, '#00e5ff', '#ff2fb9', false);
      const hover = m.cityHoverCar(0, '#00e5ff');
      return {
        tower0Faces: t0.f.length,
        tower1Faces: t1.f.length,
        tower2Faces: t2.f.length,
        tower3Faces: t3.f.length,
        lampFaces: lamp.f.length,
        gantryFaces: gantry.f.length,
        hoverFaces: hover.f.length
      };
    })()`);
    console.log('🏙️ Stage 9 Neon City 3D Model Audit:', modelAudit);

    // 2. Capture Hero Shot 1: Same position as baseline (dist ~22m, high quality)
    await client.evaluate(`(() => {
      const g = window.NY3D;
      if (g.TUTORIAL_SYSTEM) g.TUTORIAL_SYSTEM.hideIntro();
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      const ld = document.getElementById('load');
      if (ld) { ld.classList.add('gone'); ld.style.display = 'none'; }
      g.G.quality = 'high';
      g.selectStartingBiome(0);
      g.startRun();
      g.G.invul = 999;
      for (let i = 0; i < 22; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(150);
    await client.screenshot('01_after_neon_city_hero.png');

    // 3. Capture Shot 2: Further down the Neon City corridor showing Twin-Core Skybridge Tower, Overhead Gantry & Beveled Ziggurat
    await client.evaluate(`(() => {
      const g = window.NY3D;
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      for (let i = 0; i < 55; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(150);
    await client.screenshot('02_after_neon_city_gantry_skybridge.png');

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
    console.log('⚡ Real Chrome Browser Frame-Time Benchmark (180 frames per preset):', perfResults);

    // 5. Capture Shot 3: Mobile 320x568 viewport in Neon City
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 320, height: 568, deviceScaleFactor: 2, mobile: true
    });
    await client.evaluate(`(() => {
      const g = window.NY3D;
      if (g.TUTORIAL_SYSTEM) g.TUTORIAL_SYSTEM.hideIntro();
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      g.resize();
      g.selectStartingBiome(0);
      g.startRun();
      for (let i = 0; i < 42; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(200);
    await client.screenshot('03_after_neon_city_mobile_320.png');

    const overflowCheck = await client.evaluate(`({
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    })`);
    console.log('📱 320x568 Mobile Overflow Check:', overflowCheck);
    console.log('🛡️ Console Errors Caught:', client.consoleErrors.length);
    if (client.consoleErrors.length > 0) {
      console.error('Console Errors:', client.consoleErrors);
      process.exitCode = 1;
    }
  } finally {
    if (client) client.close();
    chrome.kill();
    setTimeout(() => {
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
      process.exit(0);
    }, 400);
  }
}

runStage9QA();
