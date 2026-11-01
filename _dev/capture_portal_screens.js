const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9247;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_p_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const SHOTS_DIR = path.resolve('_dev/shots/portal_redesign');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

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
  }
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', data => {
        const msg = JSON.parse(data);
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
    await sleep(200);
  }
  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filename, buf);
    console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
  }
  close() { if (this.ws) this.ws.close(); }
}

async function capture() {
  console.log('Spawning Chrome for visual verification of 3-lane Grand Exit Portal & animations...');
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--remote-allow-origins=*',
    '--user-data-dir=' + TEMP_DIR,
    '--disable-gpu',
    '--no-sandbox',
    '--mute-audio',
    '--no-first-run',
    '--window-size=1280,720',
    GAME_URL
  ]);

  let client = null;
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
        if (targets && targets.length) break;
      } catch {}
    }
    if (!targets || !targets.length) throw new Error('Chrome targets not available');

    const page = targets.find(t => t.type === 'page') || targets[0];
    client = new CDPClient(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await sleep(600);

    await client.setViewport(1280, 720);

    // Skip intro modal and start run
    await client.evaluate(`{
      const btnSkip = document.getElementById('btnIntroSkip');
      if (btnSkip) btnSkip.click();
      const modal = document.getElementById('introModal');
      if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
      const overlay = document.querySelector('.modal-overlay:not(.hidden)');
      if (overlay) { overlay.classList.add('hidden'); overlay.style.display = 'none'; }
      const btnPlay = document.getElementById('btnPlay');
      if (btnPlay) btnPlay.click();
      if (window.NY3D) {
        window.NY3D.startRun();
      }
    }`);
    await sleep(600);

    // 1. Approaching 3-Lane Grand Exit Portal from Center Lane
    await client.evaluate(`{
      const g = window.NY3D;
      g.G.portalEntryAnim = 0;
      g.enterDimension(0);
      g.G.portalEntryAnim = 0;
      g.G.dimensionTime = 5.0;
      g.G.exitPortalSpawned = false;
      g.G.objs = g.G.objs.filter(o => !o.kind.startsWith('portal_'));
      g.update(0.016);
      const exitP = g.G.objs.find(o => o.kind === 'portal_exit');
      if (exitP) {
        exitP.z = 24;
      }
      g.G.lane = 1;
      g.G.x = 0;
      g.render();
    }`);
    await sleep(250);
    await client.captureScreenshot(path.join(SHOTS_DIR, '03_dimension_grand_exit_portal_3lanes.png'));

    // 2. Approaching 3-Lane Grand Exit Portal from Left Lane (x = -2.4m)
    await client.evaluate(`{
      const g = window.NY3D;
      g.G.lane = 0;
      g.G.x = -2.4;
      const exitP = g.G.objs.find(o => o.kind === 'portal_exit');
      if (exitP) exitP.z = 16;
      g.render();
    }`);
    await sleep(250);
    await client.captureScreenshot(path.join(SHOTS_DIR, '03b_dimension_grand_exit_portal_lane0.png'));

    // 3. Passing Grand Exit Portal -> High-Energy De-warp Shockwaves & Streamlines
    await client.evaluate(`{
      const g = window.NY3D;
      g.exitDimension();
      g.G.portalExitAnim = 1.05;
      g.render();
    }`);
    await sleep(250);
    await client.captureScreenshot(path.join(SHOTS_DIR, '04_grand_exit_warp_animation.png'));

    // 4. Dimensional Iris Collapse & Victory HUD Banner
    await client.evaluate(`{
      const g = window.NY3D;
      g.G.portalExitAnim = 0.55;
      g.render();
    }`);
    await sleep(250);
    await client.captureScreenshot(path.join(SHOTS_DIR, '05_grand_exit_warp_iris_close.png'));

    console.log('All screenshots captured successfully!');
  } finally {
    if (client) client.close();
    chrome.kill();
    try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch {}
  }
}

capture().catch(e => {
  console.error(e);
  process.exit(1);
});
