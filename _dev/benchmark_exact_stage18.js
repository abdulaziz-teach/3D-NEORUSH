const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9293;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_b18_' + Date.now());
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');

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
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
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
    if (res.exceptionDetails) {
      console.error('Exception in evaluate:', JSON.stringify(res.exceptionDetails, null, 2));
    }
    return res.result ? res.result.value : undefined;
  }
}

async function main() {
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
  for (let i = 0; i < 50; i++) {
    try {
      targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      if (targets && targets.length > 0) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  if (!targets || targets.length === 0) {
    console.error('Failed to get targets');
    chromeProc.kill();
    return;
  }

  const page = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await new Promise(r => setTimeout(r, 1500));

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

  chromeProc.kill('SIGINT');
  await new Promise(r => setTimeout(r, 500));
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch (e) {}

  console.log('Original Stage 18 Backup Benchmark Results:');
  bench.forEach(r => {
    const fps = Math.round(1000 / r.avgMs);
    console.log(`  [Biome ${r.id}] ${r.name.padEnd(24)}: ${r.avgMs.toFixed(3)} ms/frame (~${fps} FPS)`);
  });
}

main().catch(console.error);
