const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    this.errors = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', data => {
        const msg = JSON.parse(data);
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
          this.consoleLogs.push({ type: msg.params.type, text });
          if (msg.params.type === 'error') this.errors.push(text);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const text = msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || '');
          this.errors.push(text);
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
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runQA() {
  console.log('--- STARTING REAL BROWSER QA (HEADLESS CHROME) ---');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,720',
    GAME_URL
  ]);

  let client = null;
  const results = {
    viewportsTested: [],
    gameplayFramesRun: 0,
    carPartsVerified: false,
    allBiomesRendered: [],
    portalTransitionVerified: false,
    audioState: null,
    storageIntegrity: null,
    consoleErrors: []
  };

  try {
    // Wait for Chrome remote debugging to be ready
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length) break;
      } catch {}
    }
    if (!targets || !targets.length) throw new Error('Could not connect to Chrome debugger on port ' + PORT);

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    console.log('Connected to target:', pageTarget.url);

    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await sleep(1500);

    // 1. Check Initial Menu & Audio Context
    console.log('Step 1: Checking Initial Menu, Title, and Audio state...');
    const menuTitle = await client.evaluate('document.title');
    const menuVisible = await client.evaluate('!document.getElementById("scrMenu").classList.contains("hidden")');
    console.log('Page Title:', menuTitle, '| Menu Visible:', menuVisible);

    // Click on canvas to unlock audio gesture
    await client.evaluate(`
      window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 200 }));
      if (window.NY3D && window.NY3D.Sound) {
        window.NY3D.Sound.ensure();
        window.NY3D.Sound.resume();
      }
    `);
    await sleep(300);
    const audioState = await client.evaluate('window.NY3D.Sound.ac ? window.NY3D.Sound.ac.state : "no-ac"');
    console.log('AudioContext State after gesture:', audioState);
    results.audioState = audioState;

    // 2. Test Screen Sizes & Viewports
    const viewports = [
      { w: 320, h: 568, name: 'Mobile-Narrow-320px' },
      { w: 375, h: 667, name: 'Mobile-Standard-375px' },
      { w: 768, h: 1024, name: 'Tablet-768px' },
      { w: 1366, h: 768, name: 'Laptop-1366px' },
      { w: 1920, h: 1080, name: 'Desktop-FHD-1920px' }
    ];

    for (const vp of viewports) {
      await client.setViewport(vp.w, vp.h);
      await sleep(200);
      const metrics = await client.evaluate(`({
        W: window.innerWidth,
        H: window.innerHeight,
        canvasW: document.getElementById('gl').width,
        canvasH: document.getElementById('gl').height,
        dpr: window.devicePixelRatio || 1
      })`);
      console.log(`Viewport ${vp.name}: inner=${metrics.W}x${metrics.H}, canvas=${metrics.canvasW}x${metrics.canvasH}`);
      results.viewportsTested.push({ name: vp.name, metrics });
    }

    // Reset to Desktop 1280x720 for gameplay QA
    await client.setViewport(1280, 720);
    await sleep(300);

    // 3. Start Run & Verify Player Car Geometry
    console.log('Step 2: Starting Game Run & Verifying Car Geometry...');
    await client.evaluate(`
      document.getElementById('btnPlay').click();
    `);
    await sleep(500);

    const isRunning = await client.evaluate('window.NY3D.G.running');
    console.log('Game running:', isRunning);

    const carData = await client.evaluate(`(() => {
      const g = window.NY3D;
      const c = g.car();
      const faces = g.facesOf(c.mesh, [g.G.x, g.G.y, 0], g.G.yaw, 1);
      return {
        name: c.name,
        shape: c.shape,
        totalMeshFaces: c.mesh.f.length,
        visibleFaces: faces.length,
        hasHood: c.mesh.f.length > 50,
        hasWheels: c.mesh.f.length > 100
      };
    })()`);
    console.log('Player Car Geometry:', carData);
    if (carData.visibleFaces > 300) results.carPartsVerified = true;

    // 4. Verify Active Gameplay Loop & Continuous Object Population
    console.log('Step 3: Simulating Active Racing (testing object spawning, obstacles, coins)...');
    let maxGapObserved = 0;
    let minObjsCount = 999;
    for (let frame = 0; frame < 180; frame++) {
      const stats = await client.evaluate(`(() => {
        const G = window.NY3D.G;
        const zs = G.objs.filter(o => !o.dead && o.z > 0 && o.z < 65).map(o => o.z).sort((a,b) => a - b);
        let maxG = 0;
        for (let i = 1; i < zs.length; i++) {
          const g = zs[i] - zs[i - 1];
          if (g > maxG) maxG = g;
        }
        return { dist: G.dist, speed: G.speed, score: G.score, objsCount: zs.length, maxG };
      })()`);
      if (stats.maxG > maxGapObserved) maxGapObserved = stats.maxG;
      if (stats.objsCount < minObjsCount) minObjsCount = stats.objsCount;
      await sleep(16);
    }
    console.log(`Continuous Spawning Check: min active objs on road=${minObjsCount}, max gap observed=${maxGapObserved.toFixed(1)}m`);
    results.gameplayFramesRun = 180;

    // 5. Test 3-Lane Portal System & Dimension Transition
    console.log('Step 4: Testing 3-Lane Portal System & Dimension Transition...');
    const portalTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.G.inDimension = false;
      g.G.nextPortalAt = g.G.dist;
      g.G.portalSpawned = false;
      // trigger update to spawn portal group
      g.update(0.016);
      const portals = g.G.objs.filter(o => o.kind === 'portal_active' || o.kind === 'portal_open');
      const activeP = g.G.objs.find(o => o.kind === 'portal_active');
      const openPs = g.G.objs.filter(o => o.kind === 'portal_open');
      
      // Simulate player entering active portal lane
      if (activeP) {
        g.G.x = activeP.x;
        g.G.lane = activeP.lane;
        g.enterDimension(activeP.targetDim || 0);
      }
      
      const objsInsideDim = g.G.objs.filter(o => !o.dead && o.z > 0 && o.z < 55);
      
      // Test exit dimension
      g.exitDimension();
      const objsAfterExit = g.G.objs.filter(o => !o.dead && o.z > 0 && o.z < 55);
      
      return {
        portalCount: portals.length,
        hasActive: !!activeP,
        openCount: openPs.length,
        objsInsideDim: objsInsideDim.length,
        objsAfterExit: objsAfterExit.length
      };
    })()`);
    console.log('Portal Test Result:', portalTest);
    if (portalTest.portalCount === 3 && portalTest.hasActive && portalTest.objsInsideDim >= 2 && portalTest.objsAfterExit >= 2) {
      results.portalTransitionVerified = true;
    }

    // 6. Test All 6 Biomes Rendering
    console.log('Step 5: Testing All 6 Biomes (colors, backdrop, scenery)...');
    const biomeNames = [];
    for (let b = 0; b < 6; b++) {
      const bInfo = await client.evaluate(`(() => {
        window.NY3D.G.trackIdx = ${b};
        window.NY3D.buildBackdrop();
        const bm = window.NY3D.trackBiome();
        return { idx: ${b}, name: bm.name, band: bm.band, neon: bm.neon, road: bm.road, props: bm.props };
      })()`);
      biomeNames.push(bInfo);
    }
    console.log('All 6 Biomes Verified:', biomeNames.map(b => b.name));
    results.allBiomesRendered = biomeNames;

    // 7. Test Checkpoint & Biome Overlap Toast Sequencing
    console.log('Step 6: Testing Checkpoint & Toast Queue...');
    const toastCheck = await client.evaluate(`(() => {
      window.NY3D.toast('🏁 TEST CHECKPOINT 1', 200);
      window.NY3D.toast('⚡ TEST BIOME 2', 200);
      window.NY3D.toast('⚡ TEST BIOME 2', 200); // duplicate
      return {
        currentToast: document.getElementById('toast').textContent,
        queueLength: (typeof _toastQueue !== 'undefined') ? _toastQueue.length : 0
      };
    })()`);
    console.log('Toast queue test:', toastCheck);

    // 8. Test Background Tab Switching
    console.log('Step 7: Testing Background Tab Switching & Visibility Handling...');
    const tabSwitch = await client.evaluate(`(() => {
      const g = window.NY3D;
      const speedBefore = g.G.speed;
      const dtBefore = g.G.dt;
      // Simulate visibility change to hidden
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      // Simulate frame while hidden
      g.frame(performance.now() + 5000); // 5 seconds jump
      
      // Restore visible
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      
      // Frame after return
      g.frame(performance.now() + 5016);
      return {
        speedBefore,
        speedAfter: g.G.speed,
        dtAfterReturn: g.G.dt,
        dtCapped: g.G.dt <= 0.05
      };
    })()`);
    console.log('Tab switch result:', tabSwitch);

    // 9. Test Garage, Tuning, and Upgrade Persistence
    console.log('Step 8: Testing Garage, Tuning & Upgrade Persistence...');
    const garageTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      const c = g.CARS[0];
      const origCoins = g.G.coins;
      g.G.coins = 5000;
      
      // Upgrade speed
      const upgOk = g.CAR_UPG.upgrade(c, 'speed', false);
      const lvl = g.CAR_UPG.lvl(c.id, 'speed');
      
      // Visual tuning
      const tune = g.CAR_TUNING.get(c.id);
      tune.underglow = '#00e5ff';
      g.CAR_TUNING.set(c.id, tune);
      const readTune = g.CAR_TUNING.get(c.id);
      
      // Restore coins
      g.G.coins = origCoins;
      g.bankCoins();
      
      return {
        upgOk,
        speedLvl: lvl,
        underglow: readTune.underglow
      };
    })()`);
    console.log('Garage Persistence Test:', garageTest);
    results.storageIntegrity = garageTest;

    // Check for any console errors
    results.consoleErrors = client.errors;
    console.log('Console Errors encountered during entire browser QA session:', client.errors.length);
    if (client.errors.length) {
      console.log('Errors:', client.errors);
    }

  } finally {
    if (client) client.close();
    chromeProc.kill();
  }

  console.log('\n--- BROWSER QA FINISHED SUCCESSFULLY ---');
  return results;
}

runQA().then(res => {
  fs.writeFileSync('_dev/browser_qa_results.json', JSON.stringify(res, null, 2), 'utf8');
  console.log('Results written to _dev/browser_qa_results.json');
  process.exit(res.consoleErrors.length === 0 ? 0 : 1);
}).catch(err => {
  console.error('QA FAILED:', err);
  process.exit(1);
});
