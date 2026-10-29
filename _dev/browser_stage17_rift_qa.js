// Stage 17: Headless Chrome Visual QA & Verification for Magic Rift World AAA Overhaul
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9299;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_stage17_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/stage17_magic_rift');
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
  console.log('--- NEORUSH STAGE 17: MAGIC RIFT WORLD BROWSER QA ---');
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

    // Copy Stage 16 baseline shot to Stage 17 directory
    const baselineSrc = path.join(ART_DIR, 'biome_7_rift_desktop.png');
    if (fs.existsSync(baselineSrc)) {
      fs.copyFileSync(baselineSrc, path.join(SHOTS_DIR, '00_baseline_rift.png'));
      fs.copyFileSync(baselineSrc, path.join(ART_DIR, '00_baseline_rift.png'));
      console.log('✓ Stage 16 baseline captured as 00_baseline_rift.png');
    }

    // 1. Audit Model Polygon Counts in Browser
    const modelStats = await cdp.evaluate(`
      (function() {
        const m = BIOME_3D.models;
        const l0 = m.riftBiomeLandmark(0, '#c084fc', '#f472b6', false);
        const l1 = m.riftBiomeLandmark(1, '#c084fc', '#f472b6', false);
        const l2 = m.riftBiomeLandmark(2, '#c084fc', '#f472b6', false);
        const l3 = m.riftBiomeLandmark(3, '#c084fc', '#f472b6', false);
        const p0 = m.riftRoadsideProp(0, 1, '#c084fc', false);
        const p1 = m.riftRoadsideProp(1, 1, '#c084fc', false);
        const arch = m.riftAstralArch(0, '#c084fc', '#f472b6', false);

        return {
          aetherSpireFaces: l0.f.length,
          floatingSanctuaryFaces: l1.f.length,
          runePillarFaces: l2.f.length,
          astralObeliskFaces: l3.f.length,
          manaBeaconFaces: p0.f.length,
          celestialPylonFaces: p1.f.length,
          astralArchFaces: arch.f.length
        };
      })()
    `);
    console.log('3D Model Face Counts in Browser:');
    console.log('  Rift Aether Spire Faces:', modelStats.aetherSpireFaces);
    console.log('  Rift Floating Sanctuary Faces:', modelStats.floatingSanctuaryFaces);
    console.log('  Rift Arcane Rune Pillar Faces:', modelStats.runePillarFaces);
    console.log('  Rift Astral Obelisk Faces:', modelStats.astralObeliskFaces);
    console.log('  Rift Mana Beacon Faces:', modelStats.manaBeaconFaces);
    console.log('  Rift Celestial Pylon Faces:', modelStats.celestialPylonFaces);
    console.log('  Rift Astral Arch Faces:', modelStats.astralArchFaces);

    // 2. Capture Hero Desktop View (1280x720)
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
        G.trackIdx = 7; // Biome 7: Magic Rift World
        G.trackTimer = 0;
        G.inDimension = false;
        G.dist = 120;
        G.speed = 18;
        G.playerX = 0;
        G.cars = [];
        G.objs = [];
        CAM.x = 0;
        CAM.y = 0;
        G.t = 12.5;
        if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) BIOME_3D.initScenery();
        if (typeof render === 'function') render();
        return true;
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    const heroPath = path.join(SHOTS_DIR, '01_after_rift_hero.png');
    await cdp.screenshot(heroPath);
    console.log('✓ Captured 01_after_rift_hero.png (1280x720)');

    // 3. Capture Overhead Arch View (dist = 31.5m)
    await cdp.evaluate(`
      (function() {
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

    const archPath = path.join(SHOTS_DIR, '02_after_rift_astral_arch.png');
    await cdp.screenshot(archPath);
    console.log('✓ Captured 02_after_rift_astral_arch.png (Overhead 3-lane Astral Arch)');

    // 4. Capture Mobile View (320x568) & Verify Overflow
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 320,
      height: 568,
      deviceScaleFactor: 1,
      mobile: true
    });

    const mobileCheck = await cdp.evaluate(`
      (function() {
        G.dist = 120;
        G.speed = 18;
        G.playerX = 0;
        CAM.x = 0;
        CAM.y = 0;
        G.t = 12.5;
        if (typeof resize === 'function') resize();
        if (typeof render === 'function') render();

        const docScrollW = document.documentElement.scrollWidth;
        const docClientW = document.documentElement.clientWidth;
        const bodyScrollW = document.body.scrollWidth;
        const hasOverflow = docScrollW > docClientW || bodyScrollW > docClientW;

        return { docScrollW, docClientW, bodyScrollW, hasOverflow };
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    const mobilePath = path.join(SHOTS_DIR, '03_after_rift_mobile_320.png');
    await cdp.screenshot(mobilePath);
    console.log('✓ Captured 03_after_rift_mobile_320.png (320x568)');
    console.log(`  Mobile layout metrics: docScrollW: ${mobileCheck.docScrollW}, docClientW: ${mobileCheck.docClientW}, hasOverflow: ${mobileCheck.hasOverflow}`);

    // 5. Benchmark 60 FPS in real Chrome for Biome 7
    const fpsCheck = await cdp.evaluate(`
      (function() {
        G.state = 'run';
        G.quality = 'high';
        G.trackIdx = 7;
        G.dist = 100;
        if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) BIOME_3D.initScenery();

        const t0 = performance.now();
        const frames = 120;
        for (let f = 0; f < frames; f++) {
          G.t += 0.016;
          G.dist += 0.3;
          if (typeof render === 'function') render();
        }
        const elapsed = performance.now() - t0;
        const avgMs = elapsed / frames;
        return { avgMs: Number(avgMs.toFixed(3)), fps: Number((1000 / avgMs).toFixed(1)) };
      })()
    `);
    console.log(`  Biome 7 Performance: ${fpsCheck.avgMs} ms/frame (${fpsCheck.fps} FPS)`);

    console.log('Console Errors during QA:', cdp.consoleErrors.length);
    if (cdp.consoleErrors.length > 0) {
      console.log('Errors:', cdp.consoleErrors);
    }

    console.log('\n=== QA VERIFICATION COMPLETE ===');

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGTERM');
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (e) {}
  }
}

run().catch(err => {
  console.error('QA Script Error:', err);
  process.exit(1);
});
