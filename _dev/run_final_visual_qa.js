const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9245;
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/final_qa');

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
    const isMobile = width < 768;
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: isMobile
    });
    await this.send('Emulation.setTouchEmulationEnabled', {
      enabled: isMobile, configuration: isMobile ? 'mobile' : 'desktop'
    });
    await this.evaluate(`
      window.innerWidth = ${width};
      window.innerHeight = ${height};
      if (${isMobile}) document.body.classList.add('touch');
      else document.body.classList.remove('touch');
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
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const tmpDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'chrome_vqa_' + Date.now());
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
  const results = {
    viewports: {},
    pauseButtonTest: null,
    touchControlsTest: null,
    portalContinuityTest: null,
    hudOverlaps320: null,
    consoleErrors: []
  };

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

    // Skip intro modal if visible so we can test menus directly
    await client.evaluate(`(() => {
      localStorage.setItem('neorush_intro_seen', 'true');
      const intro = document.getElementById('introModal');
      if (intro) intro.classList.add('hidden');
    })()`);

    const viewports = [
      { w: 320, h: 568, name: '320x568' },
      { w: 375, h: 667, name: '375x667' },
      { w: 768, h: 1024, name: '768x1024' },
      { w: 1280, h: 720, name: '1280x720' }
    ];

    for (const vp of viewports) {
      console.log(`\n==================================================`);
      console.log(`  TESTING VIEWPORT: ${vp.name} (${vp.w}x${vp.h})`);
      console.log(`==================================================`);
      await client.setViewport(vp.w, vp.h);
      await sleep(250);

      results.viewports[vp.name] = {};

      // 1. MENU
      console.log(`[${vp.name}] Capturing MENU...`);
      await client.evaluate(`(() => {
        const g = window.NY3D;
        if (g && g.G && g.G.running) g.gameOver();
        const gc = document.getElementById('garageContent');
        if (gc) gc.classList.add('hidden');
        const sm = document.getElementById('scrMenu');
        if (sm) sm.classList.remove('hidden');
      })()`);
      await sleep(200);
      const menuShot = path.join(SHOTS_DIR, `${vp.name}_01_menu.png`);
      await client.captureScreenshot(menuShot);
      console.log(`  Saved: ${menuShot}`);

      // 2. GARAGE
      console.log(`[${vp.name}] Capturing GARAGE...`);
      await client.evaluate(`(() => {
        const btn = document.getElementById('btnOpenGarage');
        if (btn) btn.click();
        const tabAll = document.querySelector('.tab[data-tab="all"]');
        if (tabAll) tabAll.click();
      })()`);
      await sleep(300);
      const garageShot = path.join(SHOTS_DIR, `${vp.name}_02_garage.png`);
      await client.captureScreenshot(garageShot);
      console.log(`  Saved: ${garageShot}`);

      // 3. BIOMES
      console.log(`[${vp.name}] Capturing BIOMES...`);
      await client.evaluate(`(() => {
        const tabBiomes = document.querySelector('.tab[data-tab="biomes"]');
        if (tabBiomes) tabBiomes.click();
      })()`);
      await sleep(300);
      const biomesShot = path.join(SHOTS_DIR, `${vp.name}_03_biomes.png`);
      await client.captureScreenshot(biomesShot);
      console.log(`  Saved: ${biomesShot}`);

      // 4. ACTIVE RACE
      console.log(`[${vp.name}] Capturing ACTIVE RACE...`);
      await client.evaluate(`(() => {
        const gc = document.getElementById('garageContent');
        if (gc) gc.classList.add('hidden');
        const g = window.NY3D;
        g.startRun();
        for (let i = 0; i < 45; i++) {
          g.update(1/60);
          g.render();
        }
      })()`);
      await sleep(200);
      const raceShot = path.join(SHOTS_DIR, `${vp.name}_04_race.png`);
      await client.captureScreenshot(raceShot);
      console.log(`  Saved: ${raceShot}`);

      // Record fit metrics
      const fitMetrics = await client.evaluate(`(() => {
        const docEl = document.documentElement;
        const body = document.body;
        const hudTop = document.querySelector('.hud-top');
        return {
          docClientW: docEl.clientWidth,
          docScrollW: docEl.scrollWidth,
          bodyClientW: body.clientWidth,
          bodyScrollW: body.scrollWidth,
          hudTopScrollW: hudTop ? hudTop.scrollWidth : 0,
          fitsHorizontally: docEl.scrollWidth <= docEl.clientWidth && body.scrollWidth <= body.clientWidth
        };
      })()`);
      results.viewports[vp.name].fitMetrics = fitMetrics;
      console.log(`  Fit: docScrollW=${fitMetrics.docScrollW} <= docClientW=${fitMetrics.docClientW} (${fitMetrics.fitsHorizontally})`);
    }

    // -------------------------------------------------------------
    // FOCUSED 320px DEEP AUDIT
    // -------------------------------------------------------------
    console.log(`\n==================================================`);
    console.log(`  FOCUSED 320px AUDIT (HUD, TOUCH, PAUSE)`);
    console.log(`==================================================`);
    await client.setViewport(320, 568);
    await sleep(200);

    // 1. HUD element overlap check
    const hudOverlap = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.startRun();
      const l = document.querySelector('.stat-cluster.left').getBoundingClientRect();
      const c = document.querySelector('.stat-cluster.center').getBoundingClientRect();
      const r = document.querySelector('.stat-cluster.right').getBoundingClientRect();
      const lives = document.getElementById('lives').getBoundingClientRect();
      const coins = document.querySelector('.stat.right').getBoundingClientRect();
      const tP = document.getElementById('tP').getBoundingClientRect();

      // Check horizontal collision between clusters
      const leftOverlapsCenter = !(l.right <= c.left || l.left >= c.right);
      const centerOverlapsRight = !(c.right <= r.left || c.left >= r.right);
      const leftOverlapsRight = !(l.right <= r.left || l.left >= r.right);

      return {
        leftRect: { left: Math.round(l.left), right: Math.round(l.right), width: Math.round(l.width) },
        centerRect: { left: Math.round(c.left), right: Math.round(c.right), width: Math.round(c.width) },
        rightRect: { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) },
        livesRect: { left: Math.round(lives.left), right: Math.round(lives.right), width: Math.round(lives.width) },
        coinsRect: { left: Math.round(coins.left), right: Math.round(coins.right), width: Math.round(coins.width) },
        pauseRect: { left: Math.round(tP.left), right: Math.round(tP.right), width: Math.round(tP.width) },
        leftOverlapsCenter,
        centerOverlapsRight,
        leftOverlapsRight,
        noClusterOverlap: !leftOverlapsCenter && !centerOverlapsRight && !leftOverlapsRight,
        rightClusterWithinViewport: r.right <= 320
      };
    })()`);
    results.hudOverlaps320 = hudOverlap;
    console.log('HUD Overlap Check 320px:', hudOverlap);

    // 2. Pause button click and resume test
    console.log('\nTesting Pause button interaction at 320px...');
    const pauseTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      const tP = document.getElementById('tP');
      tP.click();
      const pauseModal = document.getElementById('scrPause');
      const pauseVisible = pauseModal && !pauseModal.classList.contains('hidden');
      const wasPaused = g.G.paused;

      // Click resume
      const btnResume = document.getElementById('btnResume');
      if (btnResume) btnResume.click();
      const resumed = !g.G.paused;
      const pauseHidden = pauseModal && pauseModal.classList.contains('hidden');

      return {
        btnPauseFound: !!tP,
        modalOpenedOnPauseClick: pauseVisible,
        gamePaused: wasPaused,
        resumedOnClick: resumed,
        modalClosedOnResume: pauseHidden,
        pauseWorksCleanly: pauseVisible && wasPaused && resumed && pauseHidden
      };
    })()`);
    results.pauseButtonTest = pauseTest;
    console.log('Pause Button Test:', pauseTest);

    // 3. Touch control buttons visibility check
    console.log('\nTesting Touch controls at 320px...');
    const touchTest = await client.evaluate(`(() => {
      const tL = document.getElementById('tL');
      const tR = document.getElementById('tR');
      const tB = document.getElementById('tB');
      const tJ = document.getElementById('tJ');

      const isMobile = window.innerWidth < 768;
      const allFound = !!(tL && tR && tB && tJ);
      const isVisible = (el) => {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };

      return {
        isMobile,
        allFound,
        tLVisible: isVisible(tL),
        tRVisible: isVisible(tR),
        tBVisible: isVisible(tB),
        tJVisible: isVisible(tJ),
        tLRect: tL ? tL.getBoundingClientRect() : null,
        tRRect: tR ? tR.getBoundingClientRect() : null,
        touchControlsReady: isVisible(tL) && isVisible(tR) && isVisible(tB) && isVisible(tJ)
      };
    })()`);
    results.touchControlsTest = touchTest;
    console.log('Touch Controls Test:', touchTest);

    // -------------------------------------------------------------
    // PORTAL TRANSITION & CAR VISIBILITY TEST
    // -------------------------------------------------------------
    console.log(`\n==================================================`);
    console.log(`  PORTAL TRANSITION & CAR VISIBILITY TEST`);
    console.log(`==================================================`);
    const portalTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      const G = g.G;
      g.startRun();
      G.speed = 24;

      // 1. Check car faces in normal run
      g.render();
      const normalCar = g.car();
      const normalFaces = g.facesOf(normalCar.mesh, [G.x, G.y, 0], G.yaw, 1).length;

      // 2. Advance into active portal dimension
      g.enterDimension(1);
      const inDim = G.inDimension;

      // Render 30 frames inside portal dimension
      let minInDimFaces = 999;
      for (let i = 0; i < 30; i++) {
        g.update(1/60);
        g.render();
        const c = g.car();
        const f = g.facesOf(c.mesh, [G.x, G.y, 0], G.yaw, 1).length;
        if (f < minInDimFaces) minInDimFaces = f;
      }

      // 3. Safely exit dimension
      g.exitDimension();
      const afterExitDim = G.inDimension;
      g.render();
      const exitCar = g.car();
      const exitFaces = g.facesOf(exitCar.mesh, [G.x, G.y, 0], G.yaw, 1).length;

      // 4. Check projection
      const p = { x: 0, y: 0, s: 0, dz: 0, vis: false };
      g.proj([G.x, 0.45 + G.y, 0], p);

      return {
        normalFaces,
        enteredDimension: inDim,
        minInDimensionFaces: minInDimFaces,
        exitedDimension: !afterExitDim,
        exitFaces,
        carProjectedVisible: p.vis,
        carNeverDisappeared: normalFaces >= 400 && minInDimFaces >= 400 && exitFaces >= 400 && p.vis
      };
    })()`);
    results.portalContinuityTest = portalTest;
    console.log('Portal Continuity Test:', portalTest);

    // Capture portal screenshot
    const portalShot = path.join(SHOTS_DIR, `portal_transit_car_visible.png`);
    await client.captureScreenshot(portalShot);
    console.log(`Saved Portal Transit Screenshot: ${portalShot}`);

    // Console Errors Check
    results.consoleErrors = client.consoleErrors;
    console.log(`\nBrowser Console Errors: ${client.consoleErrors.length}`);
    if (client.consoleErrors.length > 0) {
      console.error('Console errors:', client.consoleErrors);
    }

    fs.writeFileSync(path.join(SHOTS_DIR, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`\nAll visual QA checks complete. Results saved.`);
  } finally {
    if (client) client.close();
    chrome.kill('SIGKILL');
  }
}

run().catch(err => {
  console.error('Final Visual QA Fatal Error:', err);
  process.exit(1);
});
