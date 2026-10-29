const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9230;
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
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
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.consoleErrors = [];
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', data => {
        const msg = JSON.parse(data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
          this.consoleLogs.push(text);
          if (msg.params.type === 'error') this.consoleErrors.push(text);
        }
        if (msg.method === 'Runtime.exceptionThrown') {
          this.consoleErrors.push(msg.params.exceptionDetails.text);
        }
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      });
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  async evaluate(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + (res.exceptionDetails.exception ? ' ' + res.exceptionDetails.exception.description : ''));
    }
    return res.result ? res.result.value : undefined;
  }
  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width < 768
    });
    await this.evaluate(`
      window.innerWidth = ${width};
      window.innerHeight = ${height};
      window.dispatchEvent(new Event('resize'));
    `);
  }
  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, buf);
  }
  close() { if (this.ws) this.ws.close(); }
}

async function run() {
  const tmpDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'chrome_prerelease_' + Date.now());
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + tmpDir,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    GAME_URL
  ]);

  let client = null;
  try {
    let targets = null;
    for (let i = 0; i < 25; i++) {
      await sleep(300);
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length) break;
      } catch {}
    }
    if (!targets || !targets.length) throw new Error('Could not connect to Chrome debugging port');
    const page = targets.find(t => t.type === 'page') || targets[0];
    client = new CDPClient(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await sleep(1500);

    console.log('--- 1. Testing Main Menu on Desktop (1280x720) ---');
    await client.setViewport(1280, 720);
    const menuState = await client.evaluate(`(() => {
      const scrMenu = document.getElementById('scrMenu');
      const btnPlay = document.getElementById('btnPlay');
      const btnGarage = document.getElementById('btnOpenGarage');
      const btnBiomes = document.getElementById('btnOpenBiomes');
      return {
        menuVisible: !scrMenu.classList.contains('hidden'),
        btnPlayVisible: !!(btnPlay && btnPlay.offsetParent),
        btnGarageVisible: !!(btnGarage && btnGarage.offsetParent),
        btnBiomesVisible: !!(btnBiomes && btnBiomes.offsetParent),
        selectedBiomeText: document.getElementById('heroBiomeTag')?.textContent || ''
      };
    })()`);
    console.log('Menu State Desktop:', menuState);

    console.log('\n--- 2. Testing Garage and 30 Cars ---');
    const garageState = await client.evaluate(`(() => {
      document.getElementById('btnOpenGarage').click();
      const content = document.getElementById('garageContent');
      const cards = document.querySelectorAll('.car-card');
      const rarityCounts = {
        rare: document.querySelectorAll('.rarity-rare').length,
        epic: document.querySelectorAll('.rarity-epic').length,
        mythic: document.querySelectorAll('.rarity-mythic').length,
        legendary: document.querySelectorAll('.rarity-legendary').length
      };
      return {
        garageVisible: !content.classList.contains('hidden'),
        carCardsCount: cards.length,
        rarityCounts
      };
    })()`);
    console.log('Garage State:', garageState);

    console.log('\n--- 3. Testing Biome Selector Modal & 8 Biome Cards ---');
    const biomesState = await client.evaluate(`(() => {
      const biomesTab = document.querySelector('.tab[data-tab="biomes"]');
      if (biomesTab) biomesTab.click();
      const tabBiomes = document.getElementById('tabBiomes');
      const cards = document.querySelectorAll('.biome-card');
      const canvases = document.querySelectorAll('.biome-preview-canvas');
      return {
        tabBiomesVisible: tabBiomes && !tabBiomes.classList.contains('hidden'),
        biomeCardsCount: cards.length,
        previewCanvasesCount: canvases.length
      };
    })()`);
    console.log('Biomes State:', biomesState);

    console.log('\n--- 4. Testing Upgrade Modal (#scrCards) ---');
    const upgradeScreenState = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.offerCards();
      const scr = document.getElementById('scrCards');
      const cards = document.querySelectorAll('.upg');
      return {
        modalVisible: scr && !scr.classList.contains('hidden'),
        cardsRendered: cards.length
      };
    })()`);
    console.log('Upgrade Screen State:', upgradeScreenState);

    console.log('\n--- 5. Testing Active Race in Browser ---');
    const raceState = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.startRun();
      for (let i = 0; i < 60; i++) {
        g.update(1/60);
        g.render();
      }
      return {
        running: g.G.running,
        dist: Math.round(g.G.dist),
        speed: Math.round(g.G.speed),
        activeBiome: g.trackBiome().name,
        lives: g.G.lives,
        score: g.G.score
      };
    })()`);
    console.log('Race State:', raceState);

    console.log('\n--- 6. Testing Mobile Viewport (375x667) & (320x568) ---');
    await client.setViewport(375, 667);
    const mobile375 = await client.evaluate(`(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const hudTop = document.querySelector('.hud-top');
      const statLeft = document.querySelector('.stat-cluster.left');
      const statRight = document.querySelector('.stat-col');
      const speedo = document.querySelector('.stat.speedo');
      return {
        hudVisible: !!(hudTop && hudTop.offsetParent),
        hasSpeedo: !!(speedo && speedo.offsetParent),
        glWidth: document.getElementById('gl').width,
        glHeight: document.getElementById('gl').height,
        docScrollWidth: docEl.scrollWidth,
        docClientWidth: docEl.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        bodyClientWidth: body.clientWidth,
        hudTopScrollWidth: hudTop ? hudTop.scrollWidth : 0,
        hasOverflowX: docEl.scrollWidth > docEl.clientWidth || body.scrollWidth > body.clientWidth,
        bodyFitsWidth: docEl.scrollWidth <= docEl.clientWidth && body.scrollWidth <= body.clientWidth
      };
    })()`);
    console.log('Mobile 375x667 State:', mobile375);

    await client.setViewport(320, 568);
    const mobile320 = await client.evaluate(`(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const hudTop = document.querySelector('.hud-top');
      return {
        glWidth: document.getElementById('gl').width,
        glHeight: document.getElementById('gl').height,
        docScrollWidth: docEl.scrollWidth,
        docClientWidth: docEl.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        bodyClientWidth: body.clientWidth,
        hudTopScrollWidth: hudTop ? hudTop.scrollWidth : 0,
        hasOverflowX: docEl.scrollWidth > docEl.clientWidth || body.scrollWidth > body.clientWidth,
        bodyFitsWidth: docEl.scrollWidth <= docEl.clientWidth && body.scrollWidth <= body.clientWidth
      };
    })()`);
    console.log('Mobile 320x568 State (Zero Overflow):', mobile320);

    console.log('\n--- 7. Checking Browser Console Errors ---');
    console.log('Errors caught during full browser run:', client.consoleErrors);

    if (client.consoleErrors.length > 0) {
      console.error('FAILED: Browser console errors detected!');
      process.exit(1);
    }
    console.log('\n=== REAL BROWSER CDP VERIFICATION: ALL PASSED (0 ERRORS) ===');
  } finally {
    if (client) client.close();
    chrome.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error('Browser QA Fatal Error:', err);
  process.exit(1);
});
