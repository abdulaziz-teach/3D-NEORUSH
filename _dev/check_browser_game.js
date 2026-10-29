const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9225;
const TEMP_DIR = 'C:\\Users\\muhsi\\AppData\\Local\\Temp\\chrome_debug_' + Date.now();
const GAME_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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

async function main() {
  console.log('Starting Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + TEMP_DIR,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,720',
    GAME_URL
  ]);

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json`);
      if (list && list[0] && list[0].webSocketDebuggerUrl) {
        wsUrl = list[0].webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    chromeProc.kill();
    throw new Error('Could not get wsUrl');
  }

  console.log('Connected to Chrome WebSocket:', wsUrl);
  const ws = new WebSocket(wsUrl);
  const logs = [];
  const errors = [];
  let id = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      callbacks.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.on('open', async () => {
    console.log('WS Open');
  });

  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      logs.push(text);
      if (msg.params.type === 'error') {
        errors.push(text);
        console.error('CONSOLE ERROR:', text);
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const text = msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || '');
      errors.push(text);
      console.error('EXCEPTION THROWN:', text);
    }
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id).resolve(msg.result);
      callbacks.delete(msg.id);
    }
  });

  await sleep(1000);
  await send('Runtime.enable');
  await send('Page.enable');

  // Let's inspect the game state in browser!
  console.log('Inspecting browser environment...');
  const state = await send('Runtime.evaluate', {
    expression: `
      (() => {
        try {
          const g = window.NY3D;
          if (!g) return { ok: false, err: 'window.NY3D not found' };
          g.startRun();
          // Advance a few frames
          for (let i = 0; i < 30; i++) {
            g.update(1/60);
            g.render();
          }
          return {
            ok: true,
            running: g.G.running,
            dist: g.G.dist,
            speed: g.G.speed,
            objs: g.G.objs.length,
            biome: g.trackBiome().name,
            cam: g.CAM,
            canvasW: document.getElementById('gl').width,
            canvasH: document.getElementById('gl').height
          };
        } catch(e) {
          return { ok: false, err: e.stack || e.message };
        }
      })()
    `,
    returnByValue: true
  });

  console.log('Game state evaluation result:', JSON.stringify(state, null, 2));

  // Now let's test specific Biome 7 (МАГИЧЕСКИЙ МИР) which is in user screenshot:
  const biome7Test = await send('Runtime.evaluate', {
    expression: `
      (() => {
        try {
          const g = window.NY3D;
          g.G.trackIdx = 7;
          g.G.dist = 111;
          g.G.speed = 345 / 3.6;
          g.render();
          return { ok: true, biome: g.trackBiome().name };
        } catch(e) {
          return { ok: false, err: e.stack || e.message };
        }
      })()
    `,
    returnByValue: true
  });
  console.log('Biome 7 Evaluation result:', JSON.stringify(biome7Test, null, 2));

  // Take screenshot of canvas
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  if (ss && ss.data) {
    fs.writeFileSync('_dev/test_capture.png', Buffer.from(ss.data, 'base64'));
    console.log('Saved screenshot to _dev/test_capture.png');
  }

  console.log('Errors collected:', errors);
  ws.close();
  chromeProc.kill();
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch (e) {}
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
