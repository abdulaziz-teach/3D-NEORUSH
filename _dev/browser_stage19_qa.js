// Stage 19: Comprehensive Visual QA & Regression Suite
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9292;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_stage19_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/stage19_optimized');
const ART_DIR = 'C:\\Users\\muhsi\\.gemini\\antigravity\\brain\\dfeca48b-1181-45fd-ae40-dd90997ab89c';

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });
if (!fs.existsSync(ART_DIR)) fs.mkdirSync(ART_DIR, { recursive: true });

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
          this.consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
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
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result ? res.result.value : undefined;
  }
  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
  }
}

async function main() {
  console.log('===============================================================');
  console.log('  STAGE 19: POST-OPTIMIZATION COMPREHENSIVE QA SUITE           ');
  console.log('===============================================================');

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${TEMP_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--mute-audio',
    '--no-first-run',
    '--window-size=1280,720',
    GAME_URL
  ]);

  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      if (targets && targets.length > 0) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const page = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await new Promise(r => setTimeout(r, 1200));

  const biomes = [
    { id: 0, key: 'city', name: 'NEON CITY' },
    { id: 1, key: 'crystal', name: 'CRYSTAL DESERT' },
    { id: 2, key: 'ice', name: 'ICE ORBIT' },
    { id: 3, key: 'lava', name: 'LAVA & MAGMA' },
    { id: 4, key: 'bio', name: 'EMERALD FOREST' },
    { id: 5, key: 'cosmic', name: 'COSMIC ANOMALY' },
    { id: 6, key: 'tech', name: 'UNDERWATER OCEAN' },
    { id: 7, key: 'rift', name: 'MAGIC RIFT WORLD' }
  ];

  // 1. Capture All 8 Biomes at Desktop (1280x720) and Mobile (320x568)
  for (const b of biomes) {
    // Desktop
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });

    await cdp.evaluate(`
      (function() {
        G.state = 'run';
        G.quality = 'high';
        G.trackIdx = ${b.id};
        G.trackTimer = 0;
        G.inDimension = false;
        G.dist = 110;
        G.speed = 18;
        G.playerX = 0;
        G.cars = [];
        G.objs = [];
        CAM.x = 0;
        CAM.y = 0;
        G.t = 12.5;
        if (typeof resize === 'function') resize();
        if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) BIOME_3D.initScenery();
        if (typeof render === 'function') render();
        return true;
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    const shotDesktop = `stage19_biome_${b.id}_${b.key}_desktop.png`;
    const deskPath = path.join(SHOTS_DIR, shotDesktop);
    await cdp.screenshot(deskPath);
    fs.copyFileSync(deskPath, path.join(ART_DIR, shotDesktop));
    console.log(`✓ Captured Desktop: ${shotDesktop}`);

    // Mobile
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 568,
      deviceScaleFactor: 1,
      mobile: true
    });

    await cdp.evaluate(`
      (function() {
        G.dist = 110;
        G.speed = 18;
        G.playerX = 0;
        CAM.x = 0;
        CAM.y = 0;
        G.t = 12.5;
        if (typeof resize === 'function') resize();
        if (typeof render === 'function') render();
        return true;
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    const shotMobile = `stage19_biome_${b.id}_${b.key}_mobile.png`;
    const mobPath = path.join(SHOTS_DIR, shotMobile);
    await cdp.screenshot(mobPath);
    fs.copyFileSync(mobPath, path.join(ART_DIR, shotMobile));
    console.log(`✓ Captured Mobile: ${shotMobile}`);
  }

  // 2. Responsive Viewport Overflow Check across 320, 375, 768, 1280
  console.log('\n--- Responsive Viewport Overflow Check ---');
  const viewports = [
    { w: 320, h: 568, name: '320x568 (iPhone SE)' },
    { w: 375, h: 667, name: '375x667 (iPhone 8)' },
    { w: 768, h: 1024, name: '768x1024 (iPad)' },
    { w: 1280, h: 720, name: '1280x720 (HD Desktop)' }
  ];

  for (const vp of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.w,
      height: vp.h,
      deviceScaleFactor: 1,
      mobile: vp.w < 768
    });

    const metrics = await cdp.evaluate(`
      (function() {
        if (typeof resize === 'function') resize();
        if (typeof render === 'function') render();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > ${vp.w}
        };
      })()
    `);
    console.log(`  [${vp.name}] Width: ${metrics.scrollWidth} / ${vp.w} — Overflow: ${metrics.hasOverflow ? 'FAIL ❌' : 'PASS ✅'}`);
  }

  // 3. Verify riftAstralArch overhead clearance
  console.log('\n--- Verifying riftAstralArch Overhead Clearance ---');
  const archCheck = await cdp.evaluate(`
    (function() {
      G.state = 'run';
      G.quality = 'high';
      G.trackIdx = 7; // rift
      G.dist = 31.5; // position right before arch
      G.speed = 14;
      G.playerX = 0; // Center lane
      CAM.x = 0;
      CAM.y = 0;
      G.t = 14.0;
      if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) BIOME_3D.initScenery();
      if (typeof render === 'function') render();
      // Ensure no obstacles spawned in center lane directly under arch
      const blockingObjs = G.objs.filter(o => Math.abs(o.z - 35) < 3.0 && o.lane === 1);
      return {
        blockingCount: blockingObjs.length,
        hasCollision: blockingObjs.length > 0
      };
    })()
  `);
  console.log(`  riftAstralArch Center Lane Collision: ${archCheck.hasCollision ? 'FAIL ❌' : 'CLEAR ✅'}`);

  console.log(`\nBrowser Console Errors: ${cdp.consoleErrors.length}`);
  if (cdp.consoleErrors.length > 0) {
    console.error('Console Errors:', cdp.consoleErrors);
  }

  chromeProc.kill('SIGINT');
  await new Promise(r => setTimeout(r, 500));
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch (e) {}

  console.log('\n===============================================================');
  console.log('✅ STAGE 19 COMPREHENSIVE QA & VERIFICATION COMPLETE!');
  console.log('===============================================================');
}

main().catch(console.error);
