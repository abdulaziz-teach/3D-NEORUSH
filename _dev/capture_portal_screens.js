const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9225;
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
  }
  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, buf);
  }
  close() { if (this.ws) this.ws.close(); }
}

async function capture() {
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    GAME_URL
  ]);

  let client = null;
  try {
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length) break;
      } catch {}
    }
    const page = targets.find(t => t.type === 'page') || targets[0];
    client = new CDPClient(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await sleep(600);

    // 1. Desktop start game
    await client.setViewport(1280, 720);
    await client.evaluate(`document.getElementById('btnPlay').click();`);
    await sleep(500);

    // Setup active portal at approaching distance z=18
    await client.evaluate(`{
      const g = window.NY3D;
      g.G.inDimension = false;
      g.G.nextPortalAt = g.G.dist;
      g.G.portalSpawned = false;
      g.update(0.016);
      const activeP = g.G.objs.find(o => o.kind === 'portal_active');
      if (activeP) {
        g.G.x = activeP.x;
        g.G.lane = activeP.lane;
        for (const p of g.G.objs.filter(o => o.kind.startsWith('portal_'))) p.z = 18;
      }
      g.render();
    }`);
    await sleep(200);
    await client.captureScreenshot('_dev/shots/01_desktop_portal_approach_z18.png');
    console.log('Saved 01_desktop_portal_approach_z18.png');

    // Portal directly in front of car at z=3.5 (aperture opening, car visible)
    await client.evaluate(`{
      const g = window.NY3D;
      for (const p of g.G.objs.filter(o => o.kind.startsWith('portal_'))) p.z = 3.5;
      g.render();
    }`);
    await sleep(200);
    await client.captureScreenshot('_dev/shots/02_desktop_portal_aperture_z3.5.png');
    console.log('Saved 02_desktop_portal_aperture_z3.5.png');

    // Portal crossing / inside threshold z=0.5 (passing through portal arch)
    await client.evaluate(`{
      const g = window.NY3D;
      for (const p of g.G.objs.filter(o => o.kind.startsWith('portal_'))) p.z = 0.5;
      g.render();
    }`);
    await sleep(200);
    await client.captureScreenshot('_dev/shots/03_desktop_portal_passing_z0.5.png');
    console.log('Saved 03_desktop_portal_passing_z0.5.png');

    // Nitro active with lightning trails
    await client.evaluate(`{
      const g = window.NY3D;
      g.G.boost = 0.85;
      g.G.nitroT = 3.0;
      g.render();
    }`);
    await sleep(200);
    await client.captureScreenshot('_dev/shots/04_desktop_nitro_active.png');
    console.log('Saved 04_desktop_nitro_active.png');

    // Mobile narrow 320px test
    await client.setViewport(320, 568);
    await client.evaluate(`{
      const g = window.NY3D;
      g.G.boost = 0;
      g.G.nitroT = 0;
      for (const p of g.G.objs.filter(o => o.kind.startsWith('portal_'))) p.z = 8.0;
      g.render();
    }`);
    await sleep(200);
    await client.captureScreenshot('_dev/shots/05_mobile320_portal_approach.png');
    console.log('Saved 05_mobile320_portal_approach.png');

  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

capture().then(() => console.log('All Screenshots Saved Successfully!')).catch(console.error);
