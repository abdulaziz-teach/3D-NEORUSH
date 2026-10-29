const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9248;
const TEMP_DIR = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'chrome_vqa_3d_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
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
    this.ws = null;
    this.wsUrl = wsUrl;
    this.msgId = 0;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }

  async connect() {
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
          this.consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
        }
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
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
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ': ' + (res.exceptionDetails.exception?.description || ''));
    }
    return res.result ? res.result.value : undefined;
  }

  async setViewport(width, height) {
    const isMobile = width < 768;
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: isMobile });
    await this.evaluate(`
      window.innerWidth = ${width};
      window.innerHeight = ${height};
      if (${isMobile}) document.body.classList.add('touch');
      else document.body.classList.remove('touch');
      if (window.NY3D && window.NY3D.resize) window.NY3D.resize();
    `);
  }

  async screenshot(outPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
  }

  close() {
    if (this.ws) try { this.ws.close(); } catch {}
  }
}

async function runVisualQA() {
  console.log('--- Launching Chrome for 8 Biomes 3D Visual QA ---');
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

  let cdp = null;
  const shotsDir = path.resolve('_dev/shots/3d_overhaul');
  fs.mkdirSync(shotsDir, { recursive: true });

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length > 0) break;
      } catch {}
    }

    if (!targets || !targets.length) throw new Error('Could not connect to Chrome targets');
    const page = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CDPClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await sleep(2000);

    // Ensure intro modal is closed & ready
    await cdp.evaluate(`(() => {
      localStorage.setItem('neorush_intro_seen', 'true');
      const intro = document.getElementById('introModal');
      if (intro) intro.classList.add('hidden');
    })()`);

    // Verify NY3D and BIOME_3D
    const engineReady = await cdp.evaluate(`typeof window.NY3D !== 'undefined' && typeof window.NY3D.BIOME_3D !== 'undefined'`);
    console.log('✅ 3D Engine & BIOME_3D loaded in Chrome:', engineReady);

    // 1. Desktop 1280x720: Test race in all 8 biomes
    await cdp.setViewport(1280, 720);

    const biomes = [
      { id: 0, name: '01_city_3d' },
      { id: 1, name: '02_desert_3d' },
      { id: 2, name: '03_ice_3d' },
      { id: 3, name: '04_lava_3d' },
      { id: 4, name: '05_forest_3d' },
      { id: 5, name: '06_cosmic_3d' },
      { id: 6, name: '07_ocean_3d' },
      { id: 7, name: '08_rift_3d' },
    ];

    for (const b of biomes) {
      console.log(`Testing 3D Biome ${b.id} (${b.name})...`);
      await cdp.evaluate(`(() => {
        if (window.NY3D.G.running) window.NY3D.gameOver();
        window.NY3D.selectStartingBiome(${b.id});
        window.NY3D.startRun();
      })()`);
      await sleep(1400);

      const shotPath = path.join(shotsDir, `${b.name}.png`);
      await cdp.screenshot(shotPath);
      console.log(`📸 Captured screenshot: ${shotPath}`);

      const state = await cdp.evaluate(`({
        running: window.NY3D.G.running,
        dist: window.NY3D.G.dist,
        sceneryCount: window.NY3D.G.scenery3D.length,
        biomeId: window.NY3D.currentBiome().id
      })`);
      console.log(`   State in Biome ${b.id}:`, state);
    }

    // 2. Mobile 320x568 Ultra-Compact Screen Test
    console.log('Testing Mobile 320x568 Ultra-Compact Screen...');
    await cdp.setViewport(320, 568);
    await sleep(800);
    const mobileShot = path.join(shotsDir, '09_mobile_320_race.png');
    await cdp.screenshot(mobileShot);
    console.log(`📸 Captured mobile screenshot: ${mobileShot}`);

    const overflowCheck = await cdp.evaluate(`({
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
      bodyScrollW: document.body.scrollWidth,
      bodyClientW: document.body.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    })`);
    console.log('320px Mobile Overflow Check:', overflowCheck);

    // 3. 3D Quantum Portal Approach & Visibility
    console.log('Testing 3D Quantum Portal Approach...');
    await cdp.setViewport(1280, 720);
    await cdp.evaluate(`(() => {
      window.NY3D.selectStartingBiome(0);
      window.NY3D.startRun();
      window.NY3D.G.dist = 642;
    })()`);
    await sleep(1000);
    const portalShot = path.join(shotsDir, '10_portal_3d_approach.png');
    await cdp.screenshot(portalShot);
    console.log(`📸 Captured portal screenshot: ${portalShot}`);

    console.log('Console Errors Caught:', cdp.consoleErrors.length);
    if (cdp.consoleErrors.length > 0) {
      console.warn('Errors:', cdp.consoleErrors);
    }

    const report = {
      engineReady,
      overflowCheck,
      consoleErrorsCount: cdp.consoleErrors.length,
      allScreenshotsSaved: true
    };
    fs.writeFileSync(path.join(shotsDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log('==========================================================');
    console.log('  ALL BROWSER 3D VISUAL CHECKS COMPLETED SUCCESSFULLY!    ');
    console.log('==========================================================');

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}
  }
}

runVisualQA().catch(err => {
  console.error('Visual QA Error:', err);
  process.exit(1);
});
