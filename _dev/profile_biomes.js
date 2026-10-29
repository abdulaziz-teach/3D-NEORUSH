// Comprehensive Profiler for NEORUSH Biomes
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9297;
const TEMP_DIR = path.join(__dirname, 'temp_chrome_profile_' + Date.now());
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
  for (let i = 0; i < 30; i++) {
    try {
      targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
      if (targets && targets.length > 0) break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const page = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await new Promise(r => setTimeout(r, 1200));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });

  const profileData = await cdp.evaluate(`
    (function() {
      const results = [];
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

      for (const b of biomes) {
        G.state = 'run';
        G.quality = 'high';
        G.trackIdx = b.id;
        G.dist = 110;
        G.speed = 18;
        G.playerX = 0;
        G.cars = [];
        G.objs = [];
        CAM.x = 0;
        CAM.y = 0;
        G.t = 12.5;
        if (typeof resize === 'function') resize();
        if (typeof BIOME_3D !== 'undefined' && BIOME_3D.initScenery) BIOME_3D.initScenery();

        // Warm up JIT
        for (let w = 0; w < 10; w++) {
          G.t += 0.016;
          G.dist += 0.3;
          if (typeof render === 'function') render();
        }

        // Detailed measurement over 80 frames
        const frames = 80;
        const frameTimes = [];
        const breakdown = { backdrop: 0, road: 0, scenery3D: 0, other: 0 };

        for (let f = 0; f < frames; f++) {
          G.t += 0.016;
          G.dist += 0.3;

          const t0 = performance.now();

          // Breakdown probes
          const tb0 = performance.now();
          drawBackdrop();
          const tb1 = performance.now();
          breakdown.backdrop += (tb1 - tb0);

          const tr0 = performance.now();
          ctx.save();
          drawRoad();
          const tr1 = performance.now();
          breakdown.road += (tr1 - tr0);

          // Rest of standard render logic probe
          drawGate(G.nextLevelAt - G.dist);
          _renderList.length = 0;
          for (let i = 0; i < G.objs.length; i++) {
            const o = G.objs[i];
            if (o.z > -1.5 && o.z < 90 && !o.dead) _renderList.push({ z: o.z, t: 0, o });
          }
          const curBm = currentBiome();
          const bmProps = curBm.props || 'city';
          const loopLen = 140;
          if (G.scenery3D && typeof BIOME_3D !== 'undefined') {
            for (let i = 0; i < G.scenery3D.length; i++) {
              const s = G.scenery3D[i];
              const wz = ((s.distOffset - G.dist) % loopLen + loopLen) % loopLen;
              if (wz > 0.8 && wz < 78) _renderList.push({ z: wz, t: 4, s, bmProps });
            }
          }
          _renderList.push({ z: 0.05, t: 2 });
          _renderList.sort((a, b) => b.z - a.z);

          const ts0 = performance.now();
          for (let i = 0; i < _renderList.length; i++) {
            const d = _renderList[i];
            if (d.t === 4 && typeof BIOME_3D !== 'undefined') BIOME_3D.drawScenery(d.s, d.z, d.bmProps);
            else if (d.t === 2) drawShip();
            else drawObj(d.o);
          }
          const ts1 = performance.now();
          breakdown.scenery3D += (ts1 - ts0);

          drawFloatingTexts();
          drawBiomeWeather(trackBiome());
          ctx.restore();

          const totalFrame = performance.now() - t0;
          frameTimes.push(totalFrame);
        }

        frameTimes.sort((a, b) => a - b);
        const sum = frameTimes.reduce((acc, v) => acc + v, 0);
        const mean = sum / frames;
        const median = frameTimes[Math.floor(frames * 0.5)];
        const p95 = frameTimes[Math.floor(frames * 0.95)];
        const min = frameTimes[0];
        const max = frameTimes[frames - 1];

        results.push({
          id: b.id,
          key: b.key,
          name: b.name,
          mean: Number(mean.toFixed(3)),
          median: Number(median.toFixed(3)),
          p95: Number(p95.toFixed(3)),
          min: Number(min.toFixed(3)),
          max: Number(max.toFixed(3)),
          fps: Math.round(1000 / mean),
          backdropMs: Number((breakdown.backdrop / frames).toFixed(3)),
          roadMs: Number((breakdown.road / frames).toFixed(3)),
          scenery3DMs: Number((breakdown.scenery3D / frames).toFixed(3))
        });
      }
      return results;
    })()
  `);

  chromeProc.kill('SIGINT');
  await new Promise(r => setTimeout(r, 500));
  try { fs.rmSync(TEMP_DIR, { recursive: true, force: true }); } catch (e) {}

  console.log('\n=== BASELINE PERFORMANCE PROFILING RESULTS ===');
  console.log(JSON.stringify(profileData, null, 2));

  fs.writeFileSync('_dev/baseline_stage19_profile.json', JSON.stringify(profileData, null, 2), 'utf8');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
