"use strict";

/* Online duel client. Match state and collision outcomes come from server.js. */
(() => {
  const $ = (id) => document.getElementById(id);
  const setup = $('scrDuel');
  const arena = $('duelArena');
  const canvas = $('duelCanvas');
  const ctx = canvas.getContext('2d');
  let socket = null;
  let playerId = '';
  let roomId = '';
  let state = null;
  let leaving = false;
  let lastInput = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;

  $('duelServer').value = store.get('duelServer', $('duelServer').value);
  $('duelName').value = store.get('duelName', '');

  function setStatus(message) { $('duelStatus').textContent = message; }
  function isOpen() { return socket && socket.readyState === WebSocket.OPEN; }
  function send(message) {
    if (isOpen()) socket.send(JSON.stringify(message));
  }
  function openSetup() {
    hide(el.scrMenu);
    hide(el.scrOver);
    show(setup);
    setStatus('');
  }
  function validName() {
    const name = $('duelName').value.trim();
    if (!name) {
      setStatus('Avval oʼyinchi nomini kiriting.');
      $('duelName').focus();
      return '';
    }
    return name.slice(0, 18);
  }
  function connect(action) {
    if (socket && socket.readyState < WebSocket.CLOSING) {
      setStatus('Serverga ulanish allaqachon davom etmoqda.');
      return;
    }
    const name = validName();
    if (!name) return;
    const address = $('duelServer').value.trim();
    let parsed;
    try {
      parsed = new URL(address);
      if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error('WebSocket URL kerak.');
    } catch (error) {
      setStatus(error.message || 'Server manzili notoʼgʼri.');
      return;
    }
    leaving = false;
    playerId = '';
    roomId = '';
    state = null;
    store.set('duelServer', parsed.href);
    store.set('duelName', name);
    setStatus('Serverga ulanmoqda…');
    try {
      socket = new WebSocket(parsed.href);
    } catch (error) {
      setStatus('Ulanib boʼlmadi: ' + error.message);
      return;
    }
    const connection = socket;
    connection.addEventListener('open', () => {
      if (socket !== connection) return;
      setStatus('Xona bilan bogʼlanmoqda…');
      send(action === 'create' ? { type: 'create', name } : {
        type: 'join', name, roomId: $('duelCode').value.trim().toUpperCase()
      });
    });
    connection.addEventListener('message', (event) => {
      if (socket !== connection) return;
      let message;
      try { message = JSON.parse(event.data); }
      catch {
        setStatus('Serverdan notoʼgʼri javob keldi.');
        return;
      }
      onMessage(message);
    });
    connection.addEventListener('error', () => {
      if (socket === connection && !leaving) setStatus('Serverga ulanib boʼlmadi. Server ishlayotganini tekshiring.');
    });
    connection.addEventListener('close', () => {
      if (socket !== connection || leaving) return;
      socket = null;
      if (state && state.type === 'result') return;
      if (!arena.classList.contains('hidden')) {
        $('duelRound').textContent = 'Ulanish uzildi';
        $('duelResultTitle').textContent = 'DUEL UZILDI';
        $('duelResultText').textContent = 'Server aloqasi uzildi. Mukofot berilmadi.';
        show($('duelResult'));
      } else if (setup.classList.contains('hidden') === false) {
        setStatus('Server bilan aloqa uzildi.');
      }
    });
  }
  function onMessage(message) {
    if (message.type === 'error') {
      setStatus(message.message || 'Server xatosi.');
      if (!setup.classList.contains('hidden') && socket) {
        leaving = true;
        socket.close();
        socket = null;
      }
      return;
    }
    if (message.type === 'created' || message.type === 'joined') {
      playerId = message.playerId;
      roomId = message.roomId;
      $('duelRoom').textContent = 'XONA ' + roomId;
      $('duelCode').value = roomId;
      setStatus(message.type === 'created'
        ? 'Xona tayyor. Doʼstingizga ' + roomId + ' kodini yuboring.'
        : 'Xonaga kirdingiz. Ikkinchi oʼyinchi kutilyapti…');
      return;
    }
    if (message.type === 'waiting') {
      setStatus('Ikkinchi oʼyinchi kutilyapti…');
      return;
    }
    if (message.type === 'matched') {
      roomId = message.roomId;
      $('duelRoom').textContent = 'XONA ' + roomId;
      hide(setup);
      show(arena);
      hide($('duelResult'));
      resize();
      return;
    }
    if (message.type === 'state') {
      state = message;
      updatePlayerPanels();
      return;
    }
    if (message.type === 'result') showResult(message);
  }
  function updatePlayerPanels() {
    if (!state || !state.players) return;
    const one = state.players[0], two = state.players[1];
    if (one) renderPlayer($('duelP1'), one);
    if (two) renderPlayer($('duelP2'), two);
    const remaining = Math.max(0, Math.ceil((state.startAt - Date.now()) / 1000));
    $('duelRound').textContent = !state.started
      ? (remaining ? 'BOSHLANISHIGA ' + remaining : 'TAYYORLANING')
      : Math.floor(state.distance) + ' m';
  }
  function renderPlayer(box, player) {
    box.querySelector('b').textContent = player.name;
    box.querySelector('span').textContent = '❤️'.repeat(Math.max(0, player.lives)) + '🖤'.repeat(3 - Math.max(0, player.lives));
  }
  function showResult(result) {
    state = result;
    updatePlayerPanels();
    $('duelRound').textContent = 'DUEL YAKUNLANDI';
    if (result.winnerId === playerId) {
      const savedPaid = store.get('duelPaid', []);
      const paid = Array.isArray(savedPaid) ? savedPaid : [];
      if (!paid.includes(result.matchId)) {
        paid.push(result.matchId);
        store.set('duelPaid', paid.slice(-50));
        G.coins += result.reward;
        bankCoins();
        menuStats();
      }
      $('duelResultTitle').textContent = 'GʼALABA!';
      $('duelResultText').textContent = 'Mukofot: +' + result.reward + ' tanga';
    } else if (result.winnerId) {
      $('duelResultTitle').textContent = 'DUEL TUGADI';
      $('duelResultText').textContent = 'Raqib gʼolib boʼldi. Keyingi safar omad!';
    } else {
      $('duelResultTitle').textContent = 'DURRANG';
      $('duelResultText').textContent = 'Ikkala oʼyinchining ham joni tugadi. Tanga berilmadi.';
    }
    show($('duelResult'));
  }
  function move(direction) {
    const now = Date.now();
    if (!isOpen() || !state || !state.started || now - lastInput < 110) return;
    lastInput = now;
    send({ type: 'move', direction });
  }
  function leave() {
    leaving = true;
    send({ type: 'leave' });
    if (socket) socket.close();
    socket = null;
    state = null;
    hide(setup);
    hide(arena);
    hide($('duelResult'));
    hide(el.scrOver);
    show(el.scrMenu);
    menuStats();
  }
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function roundedRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }
  function draw() {
    requestAnimationFrame(draw);
    if (arena.classList.contains('hidden')) return;
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#080c24'); sky.addColorStop(.53, '#241046'); sky.addColorStop(1, '#080b17');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const top = height * .25, bottom = height * .88;
    const roadTop = width * .28, roadBottom = width * .94;
    ctx.fillStyle = '#202339';
    ctx.beginPath();
    ctx.moveTo(width / 2 - roadTop, top); ctx.lineTo(width / 2 + roadTop, top);
    ctx.lineTo(width / 2 + roadBottom, bottom); ctx.lineTo(width / 2 - roadBottom, bottom);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,229,255,.46)'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2 - roadTop, top); ctx.lineTo(width / 2 - roadBottom, bottom);
    ctx.moveTo(width / 2 + roadTop, top); ctx.lineTo(width / 2 + roadBottom, bottom);
    ctx.stroke();
    for (let lane = 1; lane < 3; lane++) {
      const xTop = width / 2 - roadTop + roadTop * 2 * lane / 3;
      const xBottom = width / 2 - roadBottom + roadBottom * 2 * lane / 3;
      ctx.strokeStyle = 'rgba(206,235,255,.26)'; ctx.lineWidth = 2;
      ctx.setLineDash([14, 14]);
      ctx.beginPath(); ctx.moveTo(xTop, top); ctx.lineTo(xBottom, bottom); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state && state.players) {
      const distance = state.distance || 0;
      for (const obstacle of state.obstacles || []) {
        const ahead = obstacle.at - distance;
        if (ahead <= 0 || ahead > 65) continue;
        const t = 1 - ahead / 65;
        const y = top + (bottom - top) * t * t;
        const half = roadTop + (roadBottom - roadTop) * t;
        const laneX = width / 2 - half + half * 2 * (obstacle.lane + .5) / 3;
        const size = 9 + t * 28;
        ctx.shadowColor = '#ff2b43'; ctx.shadowBlur = 12;
        roundedRect(laneX - size, y - size * .55, size * 2, size * 1.1, 5, '#ff344e');
        ctx.shadowBlur = 0;
      }
      state.players.forEach((player, index) => {
        const t = index === 0 ? .78 : .88;
        const half = roadTop + (roadBottom - roadTop) * t;
        const x = width / 2 - half + half * 2 * (player.lane + .5) / 3;
        const y = top + (bottom - top) * t;
        const color = index === 0 ? '#00e5ff' : '#ff55c8';
        ctx.globalAlpha = player.invulnerable ? .5 + .35 * Math.sin(Date.now() / 70) : 1;
        ctx.shadowColor = color; ctx.shadowBlur = 17;
        roundedRect(x - 17, y - 26, 34, 52, 9, color);
        roundedRect(x - 11, y - 18, 22, 16, 5, '#10162c');
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(index ? '2' : '1', x, y + 42);
      });
    }
    if (!state || !state.started) {
      ctx.fillStyle = '#fff'; ctx.font = '900 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('DUEL MAYDONI', width / 2, height * .55);
    }
  }

  $('btnDuel').addEventListener('click', openSetup);
  $('btnDuelBack').addEventListener('click', leave);
  $('btnDuelCreate').addEventListener('click', () => connect('create'));
  $('btnDuelJoin').addEventListener('click', () => {
    if (!$('duelCode').value.trim()) { setStatus('Xona kodini kiriting.'); return; }
    connect('join');
  });
  $('btnDuelResult').addEventListener('click', leave);
  $('duelExit').addEventListener('click', leave);
  $('duelTouch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-duel-move]');
    if (button) move(Number(button.dataset.duelMove));
  });
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', (event) => {
    if (arena.classList.contains('hidden')) return;
    const key = event.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') { event.preventDefault(); move(-1); }
    else if (key === 'arrowright' || key === 'd') { event.preventDefault(); move(1); }
    else if (key === 'escape') { event.preventDefault(); leave(); }
  }, true);
  resize();
  draw();
})();
