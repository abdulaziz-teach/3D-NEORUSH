// Stage 16: All-Biome Visual Differentiation Audit — Headless Chrome Capture
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9288;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_stage16_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/stage16_audit');
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
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ' ' + (res.exceptionDetails.exception ? res.exceptionDetails.exception.description : ''));
    }
    return res.result ? res.result.value : undefined;
  }
  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buf);
    const fileName = path.basename(filePath);
    fs.writeFileSync(path.join(ART_DIR, fileName), buf);
  }
  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('--- NEORUSH STAGE 16: ALL-BIOME VISUAL DIFFERENTIATION AUDIT ---');
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + TEMP_DIR,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,720',
    GAME_URL
  ]);

  let cdp = null;
  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length > 0) break;
      } catch (e) {}
    }
    if (!targets || targets.length === 0) throw new Error('Could not connect to Chrome debugging target');

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    await new Promise(r => setTimeout(r, 1000));

    // Audit Biomes list
    const biomes = await cdp.evaluate(`
      (function() {
        return BIOMES.map(b => ({
          id: b.id,
          name: b.name,
          props: b.props,
          sky0: b.sky0, sky1: b.sky1, sky2: b.sky2,
          road: b.road,
          neon: b.neon, curbc: b.curbc
        }));
      })()
    `);
    console.log('Discovered', biomes.length, 'biomes in runtime registry:');
    biomes.forEach(b => console.log(`  [${b.id}] ${b.props.padEnd(8)} "${b.name}" (neon: ${b.neon}, curbc: ${b.curbc})`));

    // Capture standard gameplay screenshots for all 8 biomes
    const biomeNames = ['city', 'crystal', 'ice', 'lava', 'bio', 'cosmic', 'tech', 'rift'];

    for (let id = 0; id < biomes.length; id++) {
      const bKey = biomes[id].props;
      console.log(`\nCapturing Biome [${id}] - ${bKey} («${biomes[id].name}»)...`);

      // 1. Set Desktop Viewport
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        mobile: false
      });

      // Prepare state at dist ~120m, camera centered
      await cdp.evaluate(`
        (function() {
          G.state = 'run';
          G.quality = 'high';
          G.trackIdx = ${id};
          G.trackTimer = 0;
          G.inDimension = false;
          G.dist = 120;
          G.speed = 18;
          G.playerX = 0;
          G.cars = [];
          G.objs = [];
          CAM.x = 0;
          CAM.y = 0;
          G.t = 12.5; // Fixed stable time for procedural animations
          if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) {
            BIOME_3D.initScenery();
          }
          if (typeof render === 'function') render();
          return true;
        })()
      `);
      await new Promise(r => setTimeout(r, 200));

      const heroDesktopPath = path.join(SHOTS_DIR, `biome_${id}_${bKey}_desktop.png`);
      await cdp.screenshot(heroDesktopPath);
      console.log(`  ✓ Saved Desktop: biome_${id}_${bKey}_desktop.png`);

      // 2. Capture Overhead Arch View (player positioned right before arch)
      await cdp.evaluate(`
        (function() {
          // In initScenery, arch is placed at mod === 0 (index 0, 7, 14, 21...)
          // With loopLen = 140 and 28 props, step = 5m. Arch is at 0, 35m, 70m, 105m...
          // Let's set dist = 32m to look directly at the 35m overhead arch
          G.dist = 31.5;
          G.speed = 14;
          G.playerX = 0;
          CAM.x = 0;
          CAM.y = 0;
          G.t = 14.0;
          if (typeof render === 'function') render();
          return true;
        })()
      `);
      await new Promise(r => setTimeout(r, 200));

      const archDesktopPath = path.join(SHOTS_DIR, `biome_${id}_${bKey}_arch.png`);
      await cdp.screenshot(archDesktopPath);
      console.log(`  ✓ Saved Arch: biome_${id}_${bKey}_arch.png`);

      // 3. Set Mobile Viewport (320x568)
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 320,
        height: 568,
        deviceScaleFactor: 1,
        mobile: true
      });

      await cdp.evaluate(`
        (function() {
          G.dist = 120;
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

      const heroMobilePath = path.join(SHOTS_DIR, `biome_${id}_${bKey}_mobile.png`);
      await cdp.screenshot(heroMobilePath);
      console.log(`  ✓ Saved Mobile: biome_${id}_${bKey}_mobile.png`);
    }

    // Benchmark frame-time per biome in real browser
    console.log('\nBenchmarking 60 FPS frame times per biome:');
    const benchResults = await cdp.evaluate(`
      (function() {
        const results = [];
        for (let b = 0; b < BIOMES.length; b++) {
          G.state = 'run';
          G.quality = 'high';
          G.trackIdx = b;
          G.dist = 100;
          if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) BIOME_3D.initScenery();
          
          const t0 = performance.now();
          const frames = 60;
          for (let f = 0; f < frames; f++) {
            G.t += 0.016;
            G.dist += 0.3;
            if (typeof render === 'function') render();
          }
          const elapsed = performance.now() - t0;
          const avgMs = elapsed / frames;
          results.push({ id: b, props: BIOMES[b].props, name: BIOMES[b].name, avgMs: Number(avgMs.toFixed(3)) });
        }
        return results;
      })()
    `);

    benchResults.forEach(r => {
      console.log(`  Biome [${r.id}] ${r.props.padEnd(8)} («${r.name}»): ${r.avgMs} ms/frame (${(1000 / r.avgMs).toFixed(1)} FPS)`);
    });

    console.log('\nConsole Errors during audit:', cdp.consoleErrors.length);
    if (cdp.consoleErrors.length > 0) {
      console.log('Errors:', cdp.consoleErrors);
    }

    console.log('\n=== AUDIT CAPTURE COMPLETE ===');

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGTERM');
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

run().catch(err => {
  console.error('Audit Script Error:', err);
  process.exit(1);
});
