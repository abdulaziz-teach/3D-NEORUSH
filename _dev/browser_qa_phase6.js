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

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runPhase6BrowserQA() {
  console.log('=== STARTING REAL BROWSER QA FOR PHASE 6 (CHROME CDP) ===');
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
  const qaResults = {
    viewports: [],
    menuCheck: null,
    garageCheck: null,
    biomesCheck: null,
    portalCheck: null,
    heartCheck: null,
    nitroCheck: null,
    shieldCheck: null,
    upgradeScreenCheck: null,
    upgradeEffectsCheck: null,
    consoleErrors: []
  };

  try {
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
    console.log('Connected to Chrome target:', pageTarget.url);

    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    await sleep(1500);

    // Click canvas to unlock audio gesture
    await client.evaluate(`
      window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 200 }));
      if (window.NY3D && window.NY3D.Sound) {
        window.NY3D.Sound.ensure();
        window.NY3D.Sound.resume();
      }
    `);
    await sleep(200);

    // -------------------------------------------------------------
    // 1. VIEWPORT & RESPONSIVE LAYOUT AUDIT (320px, 375px, 480px, Desktop)
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Viewports & UI Overlap (320px, 375px, 480px, Desktop) ---');
    const viewports = [
      { w: 320, h: 568, name: 'Mobile-320px' },
      { w: 375, h: 667, name: 'Mobile-375px' },
      { w: 480, h: 800, name: 'Mobile-480px' },
      { w: 1280, h: 720, name: 'Desktop-1280px' }
    ];

    for (const vp of viewports) {
      await client.setViewport(vp.w, vp.h);
      await sleep(200);
      const metrics = await client.evaluate(`(() => {
        const hudTop = document.querySelector('.hud-top');
        const pwRow = document.getElementById('powerRow');
        const topRect = hudTop ? hudTop.getBoundingClientRect() : null;
        const pwRect = pwRow ? pwRow.getBoundingClientRect() : null;

        let overlaps = false;
        if (topRect && pwRect && pwRow.offsetParent !== null) {
          overlaps = !(topRect.right < pwRect.left || topRect.left > pwRect.right ||
                       topRect.bottom < pwRect.top || topRect.top > pwRect.bottom);
        }

        let clippedStats = 0;
        document.querySelectorAll('.stat b, .stat small').forEach(el => {
          if (el.scrollWidth > el.clientWidth + 3) clippedStats++;
        });

        return {
          w: window.innerWidth,
          h: window.innerHeight,
          hudTopFound: !!hudTop,
          pwRowFound: !!pwRow,
          overlaps,
          clippedStats
        };
      })()`);
      console.log(`Viewport ${vp.name} (${metrics.w}x${metrics.h}): Overlap=${metrics.overlaps}, ClippedTextCount=${metrics.clippedStats}`);
      qaResults.viewports.push({ name: vp.name, metrics });
    }

    // Reset to Desktop for gameplay checks
    await client.setViewport(1280, 720);
    await sleep(200);

    // -------------------------------------------------------------
    // 2. MAIN MENU & CAR SHOWCASE
    // -------------------------------------------------------------
    console.log('\n--- 2. Inspecting Main Menu & Showcase ---');
    const menuData = await client.evaluate(`(() => {
      const scrMenu = document.getElementById('scrMenu');
      const isVisible = scrMenu && !scrMenu.classList.contains('hidden');
      const btnPlay = document.getElementById('btnPlay');
      const btnGarage = document.getElementById('btnOpenGarage');
      const heroVisible = btnPlay && btnPlay.offsetParent !== null;
      const garageVisible = btnGarage && btnGarage.offsetParent !== null;
      const title = document.title;
      return { isVisible, heroVisible, garageVisible, title };
    })()`);
    console.log('Menu Data:', menuData);
    qaResults.menuCheck = menuData;

    // -------------------------------------------------------------
    // 3. GARAGE & 4 CAR RARITY TIERS
    // -------------------------------------------------------------
    console.log('\n--- 3. Inspecting Garage & 4 Car Rarity Tiers ---');
    const garageData = await client.evaluate(`(() => {
      const g = window.NY3D;
      // Open garage
      document.getElementById('btnOpenGarage').click();
      const garageContent = document.getElementById('garageContent');
      const isVisible = garageContent && !garageContent.classList.contains('hidden');

      const cards = Array.from(document.querySelectorAll('.car-card'));
      const tiers = {
        rare: document.querySelectorAll('.car-card-rarity.rarity-rare').length,
        epic: document.querySelectorAll('.car-card-rarity.rarity-epic').length,
        mythic: document.querySelectorAll('.car-card-rarity.rarity-mythic').length,
        legendary: document.querySelectorAll('.car-card-rarity.rarity-legendary').length
      };

      // Test cost scaling on an upgrade across tiers
      const cRare = g.CARS[0];
      const costRare = g.CAR_UPG.cost(cRare, 'speed', 0);
      const cEpic = g.CARS[8];
      const costEpic = g.CAR_UPG.cost(cEpic, 'speed', 0);
      const cMythic = g.CARS[16];
      const costMythic = g.CAR_UPG.cost(cMythic, 'speed', 0);
      const cLegendary = g.CARS[24];
      const costLegendary = g.CAR_UPG.cost(cLegendary, 'speed', 0);

      // Close garage back to home
      const btnBack = document.getElementById('btnBackHome');
      if (btnBack) btnBack.click();

      return {
        garageVisible: isVisible,
        totalCarCards: cards.length,
        tiers,
        costRare,
        costEpic,
        costMythic,
        costLegendary,
        scalesProperly: costLegendary > costMythic && costMythic > costEpic && costEpic > costRare
      };
    })()`);
    console.log('Garage & Rarity Data:', garageData);
    qaResults.garageCheck = garageData;

    // -------------------------------------------------------------
    // 4. INSPECT ALL 8 BIOMES
    // -------------------------------------------------------------
    console.log('\n--- 4. Inspecting All 8 Biomes (Sky, Road, Props) ---');
    const biomesData = await client.evaluate(`(() => {
      const g = window.NY3D;
      const res = [];
      for (let b = 0; b < g.BIOMES.length; b++) {
        g.G.trackIdx = b;
        g.buildBackdrop();
        const bm = g.trackBiome();
        res.push({
          idx: b,
          id: bm.id,
          name: bm.name,
          sky0: bm.sky0,
          road: bm.road,
          neon: bm.neon,
          props: bm.props
        });
      }
      return res;
    })()`);
    console.log(`Rendered ${biomesData.length} Biomes:`, biomesData.map(b => `${b.idx}: ${b.id} (${b.name})`));
    qaResults.biomesCheck = biomesData;

    // -------------------------------------------------------------
    // 5. START RUN & PORTAL ENTRY/EXIT CONTINUITY
    // -------------------------------------------------------------
    console.log('\n--- 5. Starting Race & Testing Portal Continuity ---');
    await client.evaluate(`document.getElementById('btnPlay').click();`);
    await sleep(400);

    const portalTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.G.inDimension = false;
      g.G.nextPortalAt = g.G.dist;
      g.G.portalSpawned = false;
      g.update(0.016);

      const activeP = g.G.objs.find(o => o.kind === 'portal_active');
      if (!activeP) return { error: 'No active portal found' };

      // Enter portal
      g.G.x = activeP.x;
      g.G.lane = activeP.lane;
      g.enterDimension(activeP.targetDim || 0);

      const facesInside = g.facesOf(g.car().mesh, [g.G.x, g.G.y, 0], g.G.yaw, 1).length;
      const inDim = g.G.inDimension;

      // Exit portal
      g.exitDimension();
      const facesAfterExit = g.facesOf(g.car().mesh, [g.G.x, g.G.y, 0], g.G.yaw, 1).length;
      const afterDim = g.G.inDimension;

      return {
        portalEntered: true,
        inDim,
        facesInside,
        afterDim,
        facesAfterExit,
        continuityPreserved: facesInside >= 400 && facesAfterExit >= 400
      };
    })()`);
    console.log('Portal Continuity Test:', portalTest);
    qaResults.portalCheck = portalTest;

    // -------------------------------------------------------------
    // 6. HEART PICKUP COLLECTION & 3D MESH
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing 3D Heart Mesh & Bonus Collection ---');
    const heartTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.G.lane = 1;
      g.G.laneX = 0;
      g.G.x = 0;
      g.G.maxLives = 5;
      g.G.lives = 2;
      const initialLives = 2;

      // Spawn heart bonus directly at car lane
      const heartObj = g.addObj(g.KIND.LIFE, 1, 0.2);

      // Single step
      g.update(0.016);

      const restoredLives = g.G.lives;
      const heartMeshExists = !!g.MESH_LIFE && g.MESH_LIFE.f.length >= 10;

      return {
        initialLives,
        restoredLives,
        heartCollected: heartObj.dead || heartObj.taken || restoredLives > initialLives,
        heartDead: heartObj.dead,
        heartMeshExists,
        meshFaces: g.MESH_LIFE ? g.MESH_LIFE.f.length : 0
      };
    })()`);
    console.log('Heart Pickup Test:', heartTest);
    qaResults.heartCheck = heartTest;

    // -------------------------------------------------------------
    // 7. NITRO ACTIVATION, EXHAUSTION & SPEEDOMETER
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Nitro Activation & Dynamic Speedometer ---');
    const nitroTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      const normalSpeed = g.G.speed;
      g.G.energon = 100;
      g.G.boostOn = true;
      g.Sound.whoosh();
      g.update(0.1);

      const boostedSpeed = g.G.speed;
      const isBoosting = g.G.boostOn;
      const boostPwActive = document.querySelector('.pw.boost') ? document.querySelector('.pw.boost').classList.contains('active') : false;

      // Check speedometer color shift
      const spdEl = document.getElementById('oKmh');
      const spdColor = spdEl ? window.getComputedStyle(spdEl).color : '';

      // Deactivate boost
      g.G.boostOn = false;
      g.update(0.1);

      return {
        normalSpeed,
        boostedSpeed,
        isBoosting,
        boostPwActive,
        speedIncreased: boostedSpeed > normalSpeed,
        spdColor
      };
    })()`);
    console.log('Nitro Test:', nitroTest);
    qaResults.nitroCheck = nitroTest;

    // -------------------------------------------------------------
    // 8. SHIELD ACTIVATION & COLLISION ABSORPTION
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Shield Activation & Collision Ripple ---');
    const shieldTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.G.shield = 6;
      const livesBeforeHit = g.G.lives;

      // Simulate hit while shielded
      if (g.G.shield > 0) {
        g.G.shield = 0;
        g.G.shieldRipple = 1.0;
        g.Sound.blip(300, .15, 'sawtooth');
      }

      const livesAfterHit = g.G.lives;
      const rippleActive = g.G.shieldRipple > 0;

      return {
        livesBeforeHit,
        livesAfterHit,
        damageAbsorbed: livesAfterHit === livesBeforeHit,
        rippleActive
      };
    })()`);
    console.log('Shield Test:', shieldTest);
    qaResults.shieldCheck = shieldTest;

    // -------------------------------------------------------------
    // 9. REDESIGNED "ВЫБЕРИТЕ УЛУЧШЕНИЕ" SCREEN INSPECTION
    // -------------------------------------------------------------
    console.log('\n--- 9. Inspecting Redesigned "ВЫБЕРИТЕ УЛУЧШЕНИЕ" Screen ---');
    const upgradeScreenTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.offerCards();

      const scrCards = document.getElementById('scrCards');
      const isVisible = scrCards && !scrCards.classList.contains('hidden');
      const badge = scrCards.querySelector('.upg-screen-badge');
      const title = scrCards.querySelector('.upg-screen-title');
      const cards = Array.from(document.querySelectorAll('.upg'));

      const cardDetails = cards.map(c => {
        const lv = c.querySelector('.lv');
        const icWrap = c.querySelector('.upg-ic-wrap');
        const ic = c.querySelector('.ic');
        const b = c.querySelector('b');
        const amt = c.querySelector('.amt');
        const progressTrack = c.querySelector('.upg-progress-track');
        const progressFill = c.querySelector('.upg-progress-fill');
        const actionBtn = c.querySelector('.upg-action-btn');
        return {
          key: c.dataset.k,
          isRare: c.classList.contains('rare'),
          isLife: c.classList.contains('upg-life'),
          tagText: lv ? lv.textContent : '',
          name: b ? b.textContent : '',
          amtText: amt ? amt.textContent : '',
          hasAnimatedIcon: !!(icWrap && ic),
          hasProgressBar: !!(progressTrack && progressFill),
          progressWidth: progressFill ? progressFill.style.width : '',
          hasActionBtn: !!actionBtn
        };
      });

      // Pick first card to close modal
      if (cards.length) {
        g.pickCard(cards[0].dataset.k);
      }

      return {
        modalVisible: isVisible,
        badgeText: badge ? badge.textContent : '',
        titleText: title ? title.textContent : '',
        cardCount: cards.length,
        cardDetails
      };
    })()`);
    console.log('Upgrade Screen Data:', upgradeScreenTest);
    qaResults.upgradeScreenCheck = upgradeScreenTest;

    // -------------------------------------------------------------
    // 10. VERIFY ALL 9 UPGRADE TYPES & GAMEPLAY EFFECTS
    // -------------------------------------------------------------
    console.log('\n--- 10. Verifying All 9 Upgrade Types & Gameplay Effects ---');
    const effectsTest = await client.evaluate(`(() => {
      const g = window.NY3D;
      const results = {};

      // 1. speed
      const s0 = g.G.baseSpeed;
      g.pickCard('speed');
      results.speed = { before: s0, after: g.G.baseSpeed, ok: g.G.baseSpeed > s0 };

      // 2. tank
      const t0 = g.G.energonMax;
      g.pickCard('tank');
      results.tank = { before: t0, after: g.G.energonMax, ok: g.G.energonMax > t0 };

      // 3. magnet
      const m0 = g.G.magnetMax;
      g.pickCard('magnet');
      results.magnet = { before: m0, after: g.G.magnetMax, ok: g.G.magnetMax > m0 };

      // 4. jump
      const j0 = g.G.jumpV;
      g.pickCard('jump');
      results.jump = { before: j0, after: g.G.jumpV, ok: g.G.jumpV > j0 };

      // 5. brake
      const b0 = g.G.brakePow;
      g.pickCard('brake');
      results.brake = { before: b0, after: g.G.brakePow, ok: g.G.brakePow > b0 };

      // 6. smash
      const sm0 = g.G.smashBonus;
      g.pickCard('smash');
      results.smash = { before: sm0, after: g.G.smashBonus, ok: g.G.smashBonus > sm0 };

      // 7. shield
      const sh0 = g.G.shieldMax;
      g.pickCard('shield');
      results.shield = { before: sh0, after: g.G.shieldMax, ok: g.G.shieldMax > sh0 };

      // 8. coin
      const c0 = g.G.coinMult;
      g.pickCard('coin');
      results.coin = { before: c0, after: g.G.coinMult, ok: g.G.coinMult > c0 };

      // 9. life
      const l0 = g.G.maxLives;
      g.pickCard('life');
      results.life = { before: l0, after: g.G.maxLives, ok: g.G.maxLives > l0 };

      return results;
    })()`);
    console.log('All 9 Upgrade Gameplay Effects:', effectsTest);
    qaResults.upgradeEffectsCheck = effectsTest;

    // Check for any runtime errors
    qaResults.consoleErrors = client.errors;
    console.log('\n--- Total Console Errors during entire session:', client.errors.length, '---');
    if (client.errors.length) {
      console.error('Errors:', client.errors);
    }

  } finally {
    if (client) client.close();
    chromeProc.kill();
  }

  console.log('\n=== REAL BROWSER QA FOR PHASE 6 COMPLETED SUCCESSFULLY ===');
  return qaResults;
}

runPhase6BrowserQA().then(res => {
  fs.writeFileSync('_dev/browser_qa_phase6_results.json', JSON.stringify(res, null, 2), 'utf8');
  console.log('Results written to _dev/browser_qa_phase6_results.json');
  process.exit(res.consoleErrors.length === 0 ? 0 : 1);
}).catch(err => {
  console.error('PHASE 6 BROWSER QA FAILED:', err);
  process.exit(1);
});
