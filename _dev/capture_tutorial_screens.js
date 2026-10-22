const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9226;
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
    await sleep(1500);

    // 1. Desktop Intro Modal
    await client.setViewport(1280, 720);
    await client.evaluate(`{
      window.NY3D.TUTORIAL_SYSTEM.showIntro();
    }`);
    await sleep(250);
    await client.captureScreenshot('_dev/shots/06_intro_modal_desktop.png');
    console.log('Saved 06_intro_modal_desktop.png');

    // 2. Mobile 320px Intro Modal
    await client.setViewport(320, 568);
    await sleep(250);
    await client.captureScreenshot('_dev/shots/07_intro_modal_mobile320.png');
    console.log('Saved 07_intro_modal_mobile320.png');

    // 3. Desktop In-Race Tutorial Banner (Step 1)
    await client.setViewport(1280, 720);
    await client.evaluate(`{
      window.NY3D.TUTORIAL_SYSTEM.startRace(1);
      window.NY3D.render();
    }`);
    await sleep(300);
    await client.captureScreenshot('_dev/shots/08_inrace_tutorial_banner_step1.png');
    console.log('Saved 08_inrace_tutorial_banner_step1.png');

    // 4. In-Race Tutorial Banner Step 5 (Portals)
    await client.evaluate(`{
      window.NY3D.TUTORIAL_SYSTEM.setStep(5);
      window.NY3D.render();
    }`);
    await sleep(300);
    await client.captureScreenshot('_dev/shots/09_inrace_tutorial_step5_portal.png');
    console.log('Saved 09_inrace_tutorial_step5_portal.png');

    // 5. Tutorial Completion Modal
    await client.evaluate(`{
      window.NY3D.TUTORIAL_SYSTEM.showComplete();
    }`);
    await sleep(250);
    await client.captureScreenshot('_dev/shots/10_tutorial_completion_modal.png');
    console.log('Saved 10_tutorial_completion_modal.png');

    // 6. Home Landing with new «ОБУЧЕНИЕ» button
    await client.evaluate(`{
      window.NY3D.TUTORIAL_SYSTEM.hideComplete();
      window.NY3D.setMenuView('home');
      window.NY3D.menuStats();
    }`);
    await sleep(250);
    await client.captureScreenshot('_dev/shots/11_home_screen_with_tut_btn.png');
    console.log('Saved 11_home_screen_with_tut_btn.png');

  } finally {
    if (client) client.close();
    chrome.kill();
  }
}

capture().then(() => console.log('All Tutorial Screenshots Successfully Saved!')).catch(console.error);
