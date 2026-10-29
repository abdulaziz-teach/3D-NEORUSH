// Stage 18: Headless Chrome Visual QA & Verification for Biome-Specific Horizons & Atmosphere
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9298;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_stage18_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/stage18_horizons');
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
  console.log('  STAGE 18: CHROME HEADLESS VISUAL QA & VERIFICATION SUITE      ');
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

  chromeProc.on('error', (err) => {
    console.error('Failed to start Chrome:', err);
    process.exit(1);
  });

  // Wait for debug port
  let targets = null;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      if (targets && targets.length > 0) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  if (!targets || !targets[0]) {
    console.error('Chrome debug target not found');
    chromeProc.kill();
    process.exit(1);
  }

  const page = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  console.log('Chrome connected. Initializing game QA state...');
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

  const results = {
    biomesTested: biomes.length,
    shots: [],
    overflowMobile: [],
    benchmarks: []
  };

  for (const b of biomes) {
    console.log(`\nTesting Biome ${b.id}: ${b.name} (${b.key})...`);

    // 1. Desktop Viewport (1280x720)
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
        if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) {
          BIOME_3D.initScenery();
        }
        if (typeof render === 'function') render();
        return true;
      })()
    `);
    await new Promise(r => setTimeout(r, 250));

    const shotDesktop = `stage18_biome_${b.id}_${b.key}_desktop.png`;
    const deskPath = path.join(SHOTS_DIR, shotDesktop);
    await cdp.screenshot(deskPath);
    // Copy to artifact directory
    fs.copyFileSync(deskPath, path.join(ART_DIR, shotDesktop));
    results.shots.push({ biome: b.name, mode: 'Desktop', file: shotDesktop });
    console.log(`  ✓ Desktop 1280x720 captured: ${shotDesktop}`);

    // 2. Mobile Viewport (320x568)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 568,
      deviceScaleFactor: 1,
      mobile: true
    });

    const mobileMetrics = await cdp.evaluate(`
      (function() {
        G.dist = 110;
        G.speed = 18;
        G.playerX = 0;
        CAM.x = 0;
        CAM.y = 0;
        G.t = 12.5;
        if (typeof resize === 'function') resize();
        if (typeof render === 'function') render();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > 320
        };
      })()
    `);
    await new Promise(r => setTimeout(r, 250));

    const shotMobile = `stage18_biome_${b.id}_${b.key}_mobile.png`;
    const mobPath = path.join(SHOTS_DIR, shotMobile);
    await cdp.screenshot(mobPath);
    fs.copyFileSync(mobPath, path.join(ART_DIR, shotMobile));
    results.shots.push({ biome: b.name, mode: 'Mobile', file: shotMobile });
    console.log(`  ✓ Mobile 320x568 captured: ${shotMobile} (Overflow: ${mobileMetrics.hasOverflow ? 'YES ❌' : 'NO ✅'})`);
    if (mobileMetrics.hasOverflow) {
      results.overflowMobile.push(b.name);
    }
  }

  // 3. Performance Benchmarking across all 8 Biomes at 60 FPS
  console.log('\n--- Real Browser 60 FPS Performance Benchmark ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });

  const bench = await cdp.evaluate(`
    (function() {
      const out = [];
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
        out.push({ id: b, props: BIOMES[b].props, name: BIOMES[b].name, avgMs: Number(avgMs.toFixed(3)) });
      }
      return out;
    })()
  `);
  results.benchmarks = bench;

  bench.forEach(r => {
    const fps = Math.round(1000 / r.avgMs);
    console.log(`  [Biome ${r.id}] ${r.name.padEnd(24)}: ${r.avgMs.toFixed(3)} ms/frame (~${fps} FPS)`);
  });

  console.log(`\nConsole Errors in browser during session: ${cdp.consoleErrors.length}`);
  if (cdp.consoleErrors.length > 0) {
    console.error('Console Errors:', cdp.consoleErrors);
  }

  // Teardown
  chromeProc.kill('SIGINT');
  await new Promise(r => setTimeout(r, 600));
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch (e) {}

  fs.writeFileSync(path.join(SHOTS_DIR, 'stage18_qa_results.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('\n===============================================================');
  console.log('✅ ALL STAGE 18 HORIZON & ATMOSPHERE VERIFICATIONS COMPLETE!');
  console.log('===============================================================');
}

main().catch(err => {
  console.error('Fatal QA error:', err);
  process.exit(1);
});
