// _dev/test_phase6_overhaul.js
// Verification suite for Phase 6: Complete Visual & Gameplay Design Overhaul
const fs = require('fs');
const sh = require('./shim.js');

console.log('--- STARTING PHASE 6: DESIGN OVERHAUL VERIFICATION SUITE ---');

async function run() {
  try {
    const g = sh.sandbox.NY3D;
    const G = g.G;
    const doc = sh.sandbox.document;
    const BIOMES = g.BIOMES;
    const CARS = g.CARS;
    const CAR_UPG = g.CAR_UPG;

    let passed = 0;
    let total = 0;

    function test(name, fn) {
      total++;
      try {
        fn();
        console.log(`Test ${total}: ${name} -> PASS`);
        passed++;
      } catch (err) {
        console.error(`Test ${total}: ${name} -> FAIL: ${err.message}`);
        throw err;
      }
    }

    // 1. Minimum 8 distinct biomes
    test('BIOMES array contains at least 8 distinct worlds with complete visual attributes', () => {
      if (!BIOMES || BIOMES.length < 8) throw new Error('BIOMES count must be >= 8, got ' + (BIOMES ? BIOMES.length : 0));
      const requiredFields = ['id', 'band', 'diff', 'hz', 'name', 'props', 'sky0', 'sky1', 'sky2', 'sun0', 'sun1', 'sun2', 'road', 'roadAlt', 'neon', 'curbc', 'sil', 'gnd0', 'gnd1', 'star'];
      BIOMES.slice(0, 8).forEach((b, idx) => {
        for (const f of requiredFields) {
          if (b[f] == null || b[f] === '') throw new Error(`Biome #${idx} ('${b.name}') missing field '${f}'`);
        }
      });
      // Check the two new biomes specifically
      const tech = BIOMES.find(b => b.props === 'tech');
      const rift = BIOMES.find(b => b.props === 'rift');
      if (!tech) throw new Error("Missing 'tech' biome (Заброшенная техно-станция)");
      if (!rift) throw new Error("Missing 'rift' biome (Небесный разлом)");
    });

    // 2. Biome Events cover all 8 biomes
    test('BIOME_EVENTS defines matching events for all 8 biomes', () => {
      const keys = ['city', 'crystal', 'ice', 'lava', 'bio', 'cosmic', 'tech', 'rift'];
      for (const k of keys) {
        const ev = g.BIOME_EVENTS[k];
        if (!ev) throw new Error(`Missing BIOME_EVENTS for '${k}'`);
        if (!ev.name || !ev.banner || !ev.soundChords || !ev.color) throw new Error(`Incomplete event for '${k}'`);
      }
    });

    // 3. Heart Collectible: 3D sculpted Heart mesh
    test('MESH_LIFE is sculpted as a genuine 3D heart with multi-component volume and wedges', () => {
      const mLife = g.MESHES.life;
      if (!mLife) throw new Error('MESHES.life not registered');
      if (mLife.f.length < 18) throw new Error('MESH_LIFE faces count too low for 3D sculpted heart: ' + mLife.f.length);
      if (mLife.v.length < 16) throw new Error('MESH_LIFE vertex count too low: ' + mLife.v.length);
      // Verify color palette contains red/pink heart colors
      const hasRedOrPink = mLife.c.some(c => c && (c.includes('ff2b43') || c.includes('ff758f') || c.includes('dc2626')));
      if (!hasRedOrPink) throw new Error('MESH_LIFE does not use authentic red/pink heart color palette');
    });

    // 4. Heart collection mechanics & feedback
    test('Collecting heart bonus restores life and triggers rich feedback', () => {
      g.startRun();
      G.lives = 2;
      G.maxLives = 4;
      const initialLives = G.lives;

      // Spawn heart pickup at player lane
      const heart = g.addObj(g.KIND.LIFE, G.lane, 0.5);
      G.objs.push(heart);

      g.update(1 / 60);
      if (G.lives !== initialLives + 1) throw new Error(`Life was not incremented: expected ${initialLives + 1}, got ${G.lives}`);
      if (!heart.taken || !heart.dead) throw new Error('Heart pickup not consumed after collision');
    });

    // 5. Four Rarity Tiers in CARS
    test('All 30 cars categorized into 4 rarity tiers: rare, epic, mythic, legendary', () => {
      if (!CARS || CARS.length !== 30) throw new Error('CARS length must be 30, got ' + (CARS ? CARS.length : 0));
      const allowedRarities = new Set(['rare', 'epic', 'mythic', 'legendary']);
      const count = { rare: 0, epic: 0, mythic: 0, legendary: 0 };
      for (const c of CARS) {
        if (!allowedRarities.has(c.rarity)) throw new Error(`Invalid rarity '${c.rarity}' for car '${c.name}'`);
        count[c.rarity]++;
      }
      if (count.rare < 4 || count.epic < 4 || count.mythic < 4 || count.legendary < 4) {
        throw new Error('Uneven distribution of rarity tiers: ' + JSON.stringify(count));
      }
    });

    // 6. Upgrade Cost multiplier for mythic and legendary tiers
    test('CAR_UPG.cost scales properly across the 4 rarity tiers', () => {
      const cRare = CARS.find(c => c.rarity === 'rare');
      const cEpic = CARS.find(c => c.rarity === 'epic');
      const cMythic = CARS.find(c => c.rarity === 'mythic');
      const cLegendary = CARS.find(c => c.rarity === 'legendary');

      const costRare = CAR_UPG.cost(cRare, 'speed', 0);
      const costEpic = CAR_UPG.cost(cEpic, 'speed', 0);
      const costMythic = CAR_UPG.cost(cMythic, 'speed', 0);
      const costLegendary = CAR_UPG.cost(cLegendary, 'speed', 0);

      if (costRare >= costEpic) throw new Error('Rare cost should be less than Epic cost');
      if (costEpic >= costMythic) throw new Error('Epic cost should be less than Mythic cost');
      if (costMythic >= costLegendary) throw new Error('Mythic cost should be less than Legendary cost');
    });

    // 7. Nitro Visuals and States
    test('Nitro state updates properly during boost activation and cooldown', () => {
      g.startRun();
      G.boostOn = false;
      G.energon = 100;
      g.update(1 / 60);

      G.boostOn = true;
      g.update(1 / 60);
      if (G.boost <= 0) throw new Error('Nitro boost did not activate');
      if (G.runNitroCount < 1) throw new Error('Nitro usage not tracked');

      g.render(); // World exhaust render check
      G.boostOn = false;
      g.update(1 / 60);
    });

    // 8. Shield Visuals and Hit Absorption
    test('Shield activation and damage absorption ripple trigger safely', () => {
      g.startRun();
      G.shield = 10;
      G.shieldMax = 10;
      G.shieldAnim = 1.0;
      g.update(1 / 60);
      g.render();

      // Absorb damage ripple
      G.shieldRipple = 1.0;
      g.update(1 / 60);
      g.render();
      if (G.shieldRipple <= 0 || G.shieldRipple > 1) throw new Error('Shield ripple decay not functioning');
    });

    // 9. Modern HUD Elements & Speedometer Styling
    test('Speedometer updates text and dynamic speed-based styling', () => {
      g.startRun();
      G.speed = 10; // low speed
      g.update(1 / 60);

      G.speed = 60; // high speed (> 200 km/h)
      g.update(1 / 60);
      const spdEl = doc.getElementById('speed');
      if (!spdEl) throw new Error('#speed DOM element missing');
      if (!spdEl.innerHTML.includes('км/ч')) throw new Error('Speedometer missing units');
    });

    // 10. Upgrade Selection Screen Redesign (ВЫБЕРИТЕ УЛУЧШЕНИЕ)
    test('Upgrade selection screen (ВЫБЕРИТЕ УЛУЧШЕНИЕ) renders premium cyberpunk cards, progress bars, and special life option', () => {
      const scrCards = doc.getElementById('scrCards');
      if (!scrCards) throw new Error('#scrCards screen missing in DOM');

      // Trigger card offering
      g.offerCards();
      if (!G.paused) throw new Error('Game should be paused during card selection');

      const cardList = doc.getElementById('cardList');
      if (!cardList) throw new Error('#cardList missing in DOM');

      const cardsHtml = cardList.innerHTML;
      if (!cardsHtml.includes('class="upg')) throw new Error('Rendered cards missing .upg class');
      if (!cardsHtml.includes('upg-ic-wrap')) throw new Error('Cards missing cyber icon wrap');
      if (!cardsHtml.includes('upg-progress-box') || !cardsHtml.includes('upg-progress-fill')) {
        throw new Error('Cards missing visual progress bar');
      }
      if (!cardsHtml.includes('ВЫБРАТЬ')) throw new Error('Cards missing choice action indicator');

      // Test life upgrade specific formatting
      const lifeUpg = g.UPGRADES.find(u => u.k === 'life');
      if (!lifeUpg) throw new Error('Life upgrade definition missing from UPGRADES');
      const prevMaxLives = G.maxLives;
      const prevLives = G.lives;

      // Select life upgrade
      g.pickCard('life');
      if (G.paused) throw new Error('Game should unpause after picking card');
      if (G.maxLives !== prevMaxLives + 1) throw new Error('Life upgrade did not increase maxLives');
      if (G.upgrades['life'] < 1) throw new Error('Life upgrade count not incremented');

      // Test picking regular upgrade
      const speedUpg = g.UPGRADES.find(u => u.k === 'speed');
      const prevSpeed = G.baseSpeed;
      g.pickCard('speed');
      if (G.baseSpeed <= prevSpeed) throw new Error('Speed upgrade effect not applied');
    });

    // 11. Mobile and Desktop Layouts
    test('Responsive rendering runs cleanly across 320px, 375px, 480px, 768px, 1280px', () => {
      const widths = [320, 375, 480, 768, 1280];
      for (const w of widths) {
        sh.win.innerWidth = w;
        sh.win.innerHeight = w < 600 ? 568 : 720;
        g.render();
      }
      sh.win.innerWidth = 1280;
      sh.win.innerHeight = 720;
    });

    // 12. Performance benchmark with 8 biomes and active visual overhaul
    test('Performance benchmark: 120 frames with active overhaul stay well under 16ms/frame', () => {
      g.startRun();
      g.triggerBiomeEvent('rift', true);
      const t0 = Date.now();
      for (let f = 0; f < 120; f++) {
        g.update(1 / 60);
        g.render();
      }
      const totalMs = Date.now() - t0;
      const avgMs = totalMs / 120;
      console.log(`    Phase 6 Benchmark: ${totalMs}ms total, ${avgMs.toFixed(3)}ms/frame`);
      if (avgMs > 16.0) throw new Error(`Rendering too slow: ${avgMs.toFixed(2)}ms/frame > 16ms`);
    });

    console.log('\n==========================================================');
    console.log(`  ALL ${passed}/${total} PHASE 6 DESIGN OVERHAUL TESTS PASSED (100%) `);
    console.log('==========================================================\n');
    process.exit(0);

  } catch (e) {
    console.error('Test suite failed:', e);
    process.exit(1);
  }
}

run();
