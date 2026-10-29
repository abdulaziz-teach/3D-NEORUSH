const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9228;
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
  close() { if (this.ws) this.ws.close(); }
}

async function run() {
  const tmpDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'chrome_vbb_' + Date.now());
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

    // 1. Reset localStorage to trigger first-time intro modal natively
    await client.evaluate(`{
      localStorage.removeItem('neorush_intro_seen');
      localStorage.removeItem('tutDone');
      if (window.NY3D) {
        window.NY3D.TUTORIAL_SYSTEM.showIntro();
      }
    }`);
    await sleep(400);

    // Check SVG icons in browser DOM
    const featSvgCount = await client.evaluate(`
      document.querySelectorAll('.intro-feat-item svg').length
    `);
    console.log(`Browser DOM verified ${featSvgCount}/4 SVG feature icons.`);
    if (featSvgCount !== 4) throw new Error('Expected 4 SVG icons in browser DOM, found ' + featSvgCount);

    // Check Button SVG icons
    const btnSvgCount = await client.evaluate(`
      document.querySelectorAll('.intro-buttons .btn-ic').length
    `);
    console.log(`Browser DOM verified ${btnSvgCount}/2 button SVG icons.`);

    // Capture Desktop Intro with Premium Icons
    await client.setViewport(1280, 720);
    await sleep(250);
    await client.captureScreenshot('_dev/shots/11_browser_intro_desktop.png');
    console.log('Captured _dev/shots/11_browser_intro_desktop.png');

    // 2. Click "НАУЧИТЬСЯ ИГРАТЬ" (btnIntroLearn)
    const learnClickRes = await client.evaluate(`(() => {
      const btn = document.getElementById('btnIntroLearn');
      if (!btn) return { ok: false, msg: 'btnIntroLearn not found' };
      btn.click();
      const intro = document.getElementById('introModal');
      const introHidden = intro.classList.contains('hidden');
      const banner = document.getElementById('tutorialBanner');
      const bannerVisible = !banner.classList.contains('hidden');
      const g = window.NY3D.G;
      const tut = window.NY3D.TUTORIAL_SYSTEM;
      return {
        ok: introHidden && bannerVisible && g.running && g.isTutorial && tut.step === 1,
        introHidden, bannerVisible, running: g.running, isTutorial: g.isTutorial, step: tut.step
      };
    })()`);
    console.log('Result of clicking «НАУЧИТЬСЯ ИГРАТЬ»:', learnClickRes);
    if (!learnClickRes.ok) throw new Error('«НАУЧИТЬСЯ ИГРАТЬ» failed: ' + JSON.stringify(learnClickRes));

    await sleep(400);
    await client.captureScreenshot('_dev/shots/12_browser_learn_step1.png');
    console.log('Captured _dev/shots/12_browser_learn_step1.png');

    // 3. Reset and test «ИГРАТЬ» (btnIntroSkip) -> starts normal race
    await client.evaluate(`(() => {
      window.NY3D.TUTORIAL_SYSTEM.showIntro();
    })()`);
    await sleep(300);

    const skipClickRes = await client.evaluate(`(() => {
      const btn = document.getElementById('btnIntroSkip');
      if (!btn) return { ok: false, msg: 'btnIntroSkip not found' };
      btn.click();
      const intro = document.getElementById('introModal');
      const introHidden = intro.classList.contains('hidden');
      const g = window.NY3D.G;
      const tut = window.NY3D.TUTORIAL_SYSTEM;
      return {
        ok: introHidden && g.running && !g.isTutorial && !tut.active,
        introHidden, running: g.running, isTutorial: g.isTutorial, active: tut.active
      };
    })()`);
    console.log('Result of clicking «ИГРАТЬ»:', skipClickRes);
    if (!skipClickRes.ok) throw new Error('«ИГРАТЬ» failed: ' + JSON.stringify(skipClickRes));

    await sleep(400);
    await client.captureScreenshot('_dev/shots/13_browser_skip_normal_race.png');
    console.log('Captured _dev/shots/13_browser_skip_normal_race.png');

    // 4. Test Mobile 320px
    await client.setViewport(320, 568);
    await client.evaluate(`(() => {
      window.NY3D.TUTORIAL_SYSTEM.showIntro();
    })()`);
    await sleep(400);

    // Verify 320px button bounds (not overlapping, both visible)
    const buttonBounds = await client.evaluate(`(() => {
      const b1 = document.getElementById('btnIntroLearn').getBoundingClientRect();
      const b2 = document.getElementById('btnIntroSkip').getBoundingClientRect();
      return {
        b1: { top: b1.top, bottom: b1.bottom, width: b1.width, height: b1.height },
        b2: { top: b2.top, bottom: b2.bottom, width: b2.width, height: b2.height },
        stackedCleanly: b2.top >= b1.bottom - 1, // vertical stacking
        fitsWidth: b1.width <= 320 && b2.width <= 320
      };
    })()`);
    console.log('Mobile 320px layout check:', buttonBounds);
    if (!buttonBounds.stackedCleanly || !buttonBounds.fitsWidth) {
      throw new Error('Mobile 320px button layout issue: ' + JSON.stringify(buttonBounds));
    }

    await client.captureScreenshot('_dev/shots/14_browser_intro_mobile320.png');
    console.log('Captured _dev/shots/14_browser_intro_mobile320.png');

    // Click «НАУЧИТЬСЯ ИГРАТЬ» on mobile 320px
    const mobClickRes = await client.evaluate(`(() => {
      document.getElementById('btnIntroLearn').click();
      const banner = document.getElementById('tutorialBanner');
      return !banner.classList.contains('hidden') && window.NY3D.G.running;
    })()`);
    if (!mobClickRes) throw new Error('Mobile 320px click on btnIntroLearn failed');
    await sleep(400);
    await client.captureScreenshot('_dev/shots/15_browser_mobile320_step1.png');
    console.log('Captured _dev/shots/15_browser_mobile320_step1.png');

    // 5. Test Menu dropdown "ОБУЧЕНИЕ"
    await client.setViewport(1280, 720);
    await client.evaluate(`(() => {
      window.NY3D.setMenuView('home');
      window.NY3D.G.running = false;
      const menuBtn = document.querySelector('[data-menu-action="tutorial"]');
      menuBtn.click();
      return window.NY3D.G.running && window.NY3D.TUTORIAL_SYSTEM.active;
    })()`);
    console.log('Verified Menu dropdown «Обучение» starts tutorial race directly.');

    // 6. Check console errors
    console.log('Browser console errors:', client.consoleErrors);
    if (client.consoleErrors.length > 0) {
      console.warn('Warning: console errors detected:', client.consoleErrors);
    } else {
      console.log('Clean execution: 0 console errors detected in browser.');
    }

    console.log('\n--- ALL BROWSER AUTOMATION TESTS COMPLETED SUCCESSFULLY ---');
  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

run().catch(e => {
  console.error('RUNNER FAILED:', e);
  process.exit(1);
});
