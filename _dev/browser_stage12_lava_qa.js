// Stage 12: Headless Chrome Visual QA & Real Browser Frame-Time Benchmark for Lava & Magma AAA Overhaul
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9253;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_stage12_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/stage12_lava_magma');

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
          if (msg.error) rej(new Error(msg.error.message));
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
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(SHOTS_DIR, filename);
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log('📸 Captured screenshot:', outPath);
    return outPath;
  }
  close() {
    if (this.ws) try { this.ws.close(); } catch {}
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runStage12QA() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    GAME_URL
  ], { stdio: 'ignore' });

  let client = null;
  try {
    let targets = null;
    for (let i = 0; i < 35; i++) {
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

    for (let i = 0; i < 30; i++) {
      const ready = await client.evaluate(`typeof window.NY3D !== 'undefined' && !!window.NY3D.BIOME_3D`);
      if (ready) break;
      await sleep(200);
    }

    // 1. Verify all 4 Volcano Caldera Archetypes, Roadside Fumaroles, and Overhead Basalt Arch
    const modelAudit = await client.evaluate(`(() => {
      const B = window.NY3D.BIOME_3D;
      const m = B.models;
      const c0 = m.volcanoCaldera(0, '#1c1917', '#ff5500', false);
      const c1 = m.volcanoCaldera(1, '#1c1917', '#ff5500', false);
      const c2 = m.volcanoCaldera(2, '#1c1917', '#ff5500', false);
      const c3 = m.volcanoCaldera(3, '#1c1917', '#ff5500', false);
      const f0 = m.volcanoFumarole(0, -1, '#ff5500', false);
      const f1 = m.volcanoFumarole(1, 1, '#ff5500', false);
      const arch = m.volcanoBasaltArch(1, '#ff5500', '#fbbf24', false);
      return {
        caldera0Faces: c0.f.length,
        caldera1Faces: c1.f.length,
        caldera2Faces: c2.f.length,
        caldera3Faces: c3.f.length,
        fumarole0Faces: f0.f.length,
        fumarole1Faces: f1.f.length,
        archFaces: arch.f.length
      };
    })()`);
    console.log('🌋 Stage 12 Lava & Magma 3D Model Audit:', modelAudit);

    // 2. Capture Hero Shot 1: Same position as baseline (dist ~22m, high quality)
    await client.evaluate(`(() => {
      const g = window.NY3D;
      if (g.TUTORIAL_SYSTEM) g.TUTORIAL_SYSTEM.hideIntro();
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      const ld = document.getElementById('load');
      if (ld) { ld.classList.add('gone'); ld.style.display = 'none'; }
      g.G.quality = 'high';
      g.selectStartingBiome(3); // Biome 3: Lava & Magma («ЛАВА И МАГМА»)
      g.startRun();
      g.G.invul = 999;
      for (let i = 0; i < 22; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(250);
    await client.screenshot('01_after_lava_magma_hero.png');

    // 3. Capture Shot 2: Approaching the overhead volcanic basalt arch spanning the road
    await client.evaluate(`(() => {
      const g = window.NY3D;
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      for (let i = 0; i < 48; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(250);
    await client.screenshot('02_after_lava_canyon_arch.png');

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
    console.log('⚡ Real Chrome Browser Frame-Time Benchmark in Lava & Magma (180 frames per preset):', perfResults);

    // 5. Capture Shot 3: Mobile 320x568 viewport in Lava & Magma
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 320, height: 568, deviceScaleFactor: 2, mobile: true
    });
    await client.evaluate(`(() => {
      const g = window.NY3D;
      if (g.TUTORIAL_SYSTEM) g.TUTORIAL_SYSTEM.hideIntro();
      const im = document.getElementById('introModal');
      if (im) im.classList.add('hidden');
      g.resize();
      g.selectStartingBiome(3);
      g.startRun();
      for (let i = 0; i < 35; i++) g.update(0.016);
      g.render();
    })()`);
    await sleep(250);
    await client.screenshot('03_after_lava_mobile_320.png');

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
    chromeProc.kill();
    setTimeout(() => {
      try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}
      process.exit(0);
    }, 400);
  }
}

runStage12QA();
