(function () {
  var out = {};
  try {
    var N = window.NY3D;
    if (!N) { out.boot = 'NO HANDLE'; }
    else {
      out.boot = 'NY3D OK';
      N.G.tutDone = false;
      N.startRun();
      N.G.tut = false; N.setHint(-1);
      N.G.objs.length = 0;
      N.addObj('car', 0, 10);
      N.addObj('bar', 1, 14);
      N.addObj('truck', 2, 18);
      N.addObj('coin', 2, 20); N.addObj('coin', 2, 22); N.addObj('coin', 2, 24);
      N.addObj('cone', 0, 26);
      N.addObj('wall', 1, 30);
      N.addObj('nitro', 2, 32);
      N.addObj('shield', 0, 38);
      N.addObj('magnet', 1, 41);
      N.addObj('life', 2, 44);
      N.G.shield = 6; N.G.magnet = 4; N.G.boost = .5; N.G.lives = 2; N.G.speed = 14;
      for (var i = 0; i < 40; i++) { N.G.speed = 14; N.update(1 / 60); }
      N.render();
      var c = document.getElementById('gl');
      var s = document.createElement('canvas'); s.width = 780; s.height = 440;
      var x = s.getContext('2d'); x.drawImage(c, 0, 0, s.width, s.height);
      out.jpg = s.toDataURL('image/jpeg', .8);
      // ikkinchi kadr: o'yin ichida tabiiy sahna (200 kadr)
      N.G.objs.length = 0;
      for (var k = 0; k < 260; k++) { N.G.lives = 3; N.update(1 / 60); if (k % 7 === 0) N.moveLane(Math.random() < .5 ? -1 : 1); if (k % 31 === 0) N.jump(); }
      N.render();
      var s2 = document.createElement('canvas'); s2.width = 780; s2.height = 440;
      s2.getContext('2d').drawImage(c, 0, 0, s2.width, s2.height);
      out.jpg2 = s2.toDataURL('image/jpeg', .8);
      out.state = {
        dist: Math.round(N.G.dist), objs: N.G.objs.length, lives: N.G.lives,
        coins: N.G.runCoins, score: Math.round(N.G.score), level: N.G.level,
        kmh: Math.round(N.G.speed * 3.6), frameMs: Math.round(N.G.frameMs * 10) / 10, quality: N.G.quality
      };
      out.hud = {
        score: document.getElementById('score').textContent,
        speed: document.getElementById('speed').textContent,
        legend: document.getElementById('legend').className,
        hint: document.getElementById('hint').className,
        loadGone: document.getElementById('load').classList.contains('gone')
      };
    }
  } catch (e) {
    out.err = String((e && e.message) || e);
    out.stack = String((e && e.stack) || '').split('\n').slice(0, 5).join(' | ');
  }
  var n = document.getElementById('__probe');
  if (!n) { n = document.createElement('pre'); n.id = '__probe'; n.style.display = 'none'; document.documentElement.appendChild(n); }
  n.textContent = JSON.stringify(out);
  window.__probeDone = true;
})();
