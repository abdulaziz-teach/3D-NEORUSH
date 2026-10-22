const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9223;
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
    this.logs = [];
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
          this.logs.push(text);
          if (msg.params.type === 'error') this.errors.push(text);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          this.errors.push(msg.params.exceptionDetails.text);
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
  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, buf);
  }
  close() { if (this.ws) this.ws.close(); }
}

async function run() {
  console.log('Launching headless Chrome...');
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
      await sleep(500);
      try {
        targets = await getJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length) break;
      } catch {}
    }
    if (!targets || !targets.length) throw new Error('Chrome target not found');
    const page = targets.find(t => t.type === 'page') || targets[0];
    client = new CDPClient(page.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await sleep(1000);

    // Start game
    await client.evaluate(`
      document.getElementById('btnPlay').click();
    `);
    await sleep(500);

    // Spawn portal group at z = 40
    console.log('Spawning portal group and tracking frames as portal approaches car...');
    await client.evaluate(`
      const g = window.NY3D;
      g.G.inDimension = false;
      g.G.nextPortalAt = g.G.dist;
      g.G.portalSpawned = false;
      // Hook drawShip to log calls
      window._drawShipCalls = 0;
      window._lastFacesCount = 0;
      const origDrawShip = window.drawShip || g.drawShip;
    `);

    // We can inspect step-by-step as portal moves from z=30 down to z=0 and -2
    const probeResults = await client.evaluate(`(() => {
      const g = window.NY3D;
      g.G.speed = 20;
      g.G.nextPortalAt = g.G.dist;
      g.G.portalSpawned = false;
      g.update(0.016); // spawns portals at z=72

      const steps = [];
      const portals = g.G.objs.filter(o => o.kind === 'portal_active' || o.kind === 'portal_open');
      const activeP = g.G.objs.find(o => o.kind === 'portal_active');
      
      // Move active portal closer step by step
      for (let distZ = 35; distZ >= -5; distZ -= 2) {
        if (activeP) {
          activeP.z = distZ;
          // also move sibling portals
          for (const p of portals) p.z = distZ;
        }
        
        // Instrument facesOf or drawFace or renderList
        let shipInRenderList = false;
        let shipRenderIndex = -1;
        let totalItemsInRender = 0;
        let activePortalRenderIndex = -1;
        
        // Let's inspect _renderList during render()
        // We temporarily wrap render or evaluate it
        g.render();
        
        const carObj = g.car();
        const faces = g.facesOf(carObj.mesh, [g.G.x, g.G.y, 0], g.G.yaw, 1);
        
        steps.push({
          portalZ: distZ,
          inDimension: g.G.inDimension,
          portalEntryAnim: g.G.portalEntryAnim,
          facesCount: faces.length,
          carPos: [g.G.x, g.G.y],
          camPos: [g.CAM.x, g.CAM.y, g.CAM.z],
          portalActiveDead: activeP ? activeP.dead : true,
          portalActiveTaken: activeP ? activeP.taken : true
        });
      }
      return { portalsFound: portals.length, activeP: !!activeP, steps };
    })()`);

    console.log('Probe results:', JSON.stringify(probeResults, null, 2));

  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

run().catch(console.error);
