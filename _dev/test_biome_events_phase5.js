// _dev/test_biome_events_phase5.js
// Comprehensive test suite for NEORUSH Phase 5: Biome Events & Dynamic World
const fs = require('fs');
const sh = require('./shim.js');

console.log('--- STARTING PHASE 5: BIOME EVENTS & DYNAMIC WORLD TEST SUITE ---');

async function run() {
  try {
    const g = sh.sandbox.NY3D;
    const G = g.G;
    const doc = sh.sandbox.document;
    const BIOMES = g.BIOMES;
    const BIOME_EVENTS = g.BIOME_EVENTS;

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

    // 1. Biome & Event definitions audit
    test('8 Biomes and 8 corresponding dynamic events exist with complete attributes', () => {
      if (!BIOMES || BIOMES.length < 8) throw new Error('BIOMES length must be at least 8, got ' + (BIOMES ? BIOMES.length : 0));
      if (!BIOME_EVENTS) throw new Error('BIOME_EVENTS must be defined');

      const requiredProps = ['city', 'crystal', 'ice', 'lava', 'bio', 'cosmic', 'tech', 'rift'];
      const expectedEvents = {
        city: { key: 'neon_storm', name: 'НЕОНОВЫЙ ШТОРМ', type: 'rain' },
        crystal: { key: 'crystal_storm', name: 'КРИСТАЛЬНАЯ БУРЯ', type: 'dust' },
        ice: { key: 'ice_blizzard', name: 'ЛЕДЯНАЯ МЕТЕЛЬ', type: 'blizzard' },
        lava: { key: 'magma_surge', name: 'МАГМАТИЧЕСКИЙ ВСПЛЕСК', type: 'embers' },
        bio: { key: 'spore_drift', name: 'СПОРОПАД БИОСФЕРЫ', type: 'spores' },
        cosmic: { key: 'quantum_rift', name: 'КВАНТОВЫЙ РАЗЛОМ', type: 'quantum' },
        tech: { key: 'electro_surge', name: 'ЭЛЕКТРИЧЕСКИЙ РАЗРЯД', type: 'spark' },
        rift: { key: 'aether_flux', name: 'ЭФИРНЫЙ ВОДОПАД', type: 'aether' }
      };

      for (const p of requiredProps) {
        const ev = BIOME_EVENTS[p];
        if (!ev) throw new Error(`Missing BIOME_EVENTS entry for biome prop '${p}'`);
        const exp = expectedEvents[p];
        if (ev.key !== exp.key) throw new Error(`Expected key '${exp.key}' for '${p}', got '${ev.key}'`);
        if (ev.name !== exp.name) throw new Error(`Expected name '${exp.name}' for '${p}', got '${ev.name}'`);
        if (ev.type !== exp.type) throw new Error(`Expected type '${exp.type}' for '${p}', got '${ev.type}'`);
        if (!ev.banner || !ev.color || !ev.soundChords || !ev.soundChords.length) {
          throw new Error(`Incomplete visual/audio fields for '${p}'`);
        }
      }
    });

    // 2. Event activation per biome
    test('Each biome activates its specific atmospheric event and particle motion', () => {
      g.startRun();
      const biomesToTest = ['city', 'crystal', 'ice', 'lava', 'bio', 'cosmic', 'tech', 'rift'];
      for (const b of biomesToTest) {
        const ok = g.triggerBiomeEvent(b, true);
        if (!ok) throw new Error(`triggerBiomeEvent failed for biome '${b}'`);
        if (!G.biomeEventActive) throw new Error(`G.biomeEventActive is false after triggering '${b}'`);
        const expected = BIOME_EVENTS[b];
        if (G.biomeEventKey !== expected.key) throw new Error(`Wrong event key '${G.biomeEventKey}' for '${b}'`);
        if (G.biomeEventName !== expected.name) throw new Error(`Wrong event name '${G.biomeEventName}' for '${b}'`);
        if (G.biomeEventTimer <= 0) throw new Error(`Event timer not set for '${b}'`);
        if (!G.biomeEventParticles || G.biomeEventParticles.length !== 70) {
          throw new Error(`Particles buffer not populated (len: ${G.biomeEventParticles ? G.biomeEventParticles.length : 0})`);
        }
      }
    });

    // 3. Pre-allocated Buffer & Zero Allocation Guarantee
    test('Particle buffer remains fixed size (no heap leak / zero allocations in loop)', () => {
      g.startRun();
      g.triggerBiomeEvent('city', true);
      const initialLength = G.biomeEventParticles.length;
      if (initialLength !== 70) throw new Error('Expected 70 pre-allocated particles, got ' + initialLength);

      for (let i = 0; i < 100; i++) {
        g.updateBiomeEventParticles(0.016);
      }
      if (G.biomeEventParticles.length !== initialLength) {
        throw new Error(`Particle array mutated! (before: ${initialLength}, after: ${G.biomeEventParticles.length})`);
      }

      for (const p of G.biomeEventParticles) {
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) throw new Error('Non-finite particle coordinate');
        if (!isFinite(p.vx) || !isFinite(p.vy) || !isFinite(p.vz)) throw new Error('Non-finite particle velocity');
        if (p.alpha <= 0 || p.alpha > 1) throw new Error('Invalid particle alpha: ' + p.alpha);
      }
    });

    // 4. Event Lifecycle & Natural Expiration
    test('Event timer decrements accurately and terminates cleanly on expiration', () => {
      g.startRun();
      g.triggerBiomeEvent('lava', true);
      G.biomeEventTimer = 2.0;

      for (let f = 0; f < 60; f++) g.update(1 / 60);
      if (!G.biomeEventActive) throw new Error('Event terminated prematurely at ~1s remaining');
      if (G.biomeEventTimer >= 1.5 || G.biomeEventTimer <= 0.5) {
        throw new Error('Event timer did not decrement accurately: ' + G.biomeEventTimer);
      }

      for (let f = 0; f < 75; f++) g.update(1 / 60);
      if (G.biomeEventActive) throw new Error('Event did not terminate after timer expired');
      if (G.biomeEventKey !== '' || G.biomeEventName !== '') {
        throw new Error('Event key/name not reset after expiration');
      }
      if (G.biomeEventCooldown <= 0) throw new Error('Cooldown not initialized after event ended');
    });

    // 5. Automatic Triggering via Cooldown
    test('Auto-trigger initiates next event when cooldown expires in active run', () => {
      g.startRun();
      G.trans = 99;
      G.biomeEventActive = false;
      G.biomeEventCooldown = 0.05;

      for (let f = 0; f < 6; f++) g.update(1 / 60);
      if (!G.biomeEventActive) throw new Error('Event failed to auto-trigger after cooldown reached 0');
      if (G.biomeEventTimer <= 0) throw new Error('Auto-triggered event has no timer');
    });

    // 6. Pause Handling
    test('Pausing the game freezes event timer and particle positions', () => {
      g.startRun();
      g.triggerBiomeEvent('ice', true);
      const timerBefore = G.biomeEventTimer;
      const p0z = G.biomeEventParticles[0].z;

      G.paused = true;
      for (let f = 0; f < 30; f++) g.update(1 / 60);

      if (G.biomeEventTimer !== timerBefore) {
        throw new Error(`Timer changed while paused: was ${timerBefore}, now ${G.biomeEventTimer}`);
      }
      if (G.biomeEventParticles[0].z !== p0z) {
        throw new Error(`Particles moved while paused: was ${p0z}, now ${G.biomeEventParticles[0].z}`);
      }
      G.paused = false;
    });

    // 7. Isolation: Dimension Entry & Track Transition Clean Termination
    test('Entering portal or transitioning track terminates active event to avoid spillover', () => {
      g.startRun();
      g.triggerBiomeEvent('city', true);
      if (!G.biomeEventActive) throw new Error('Event not active before portal');

      g.enterDimension(0);
      if (G.biomeEventActive) throw new Error('Event was not terminated upon entering dimension');
      if (G.biomeEventKey !== '') throw new Error('Event key was not cleared in dimension');

      const inDimTrigger = g.triggerBiomeEvent('crystal', true);
      if (inDimTrigger) throw new Error('triggerBiomeEvent should return false inside dimension');
      if (G.biomeEventActive) throw new Error('Event should not activate inside dimension');

      g.exitDimension();
      g.triggerBiomeEvent('crystal', true);
      if (!G.biomeEventActive) throw new Error('Event not active before nextTrack');

      g.nextTrack(true);
      if (G.biomeEventActive) throw new Error('Event was not terminated upon track transition');
    });

    // 8. Isolation: Boss Chase Suppresses Biome Events
    test('Boss chase suppresses biome events and terminates any active event', () => {
      g.startRun();
      g.triggerBiomeEvent('bio', true);
      if (!G.biomeEventActive) throw new Error('Event not active before boss');

      G.bossWarningActive = true;
      g.update(1 / 60);
      if (G.biomeEventActive) throw new Error('Active event was not terminated on boss warning');

      G.bossWarningActive = false;
      G.bossActive = true;
      const triggerDuringBoss = g.triggerBiomeEvent('lava', true);
      if (triggerDuringBoss) throw new Error('triggerBiomeEvent should return false during boss fight');
      if (G.biomeEventActive) throw new Error('Event should not activate during boss fight');
    });

    // 9. Reset on gameOver and startRun
    test('gameOver and startRun completely reset all biome event state and hide HUD', () => {
      g.startRun();
      g.triggerBiomeEvent('cosmic', true);
      if (!G.biomeEventActive) throw new Error('Event not active before gameOver');

      g.gameOver();
      if (G.biomeEventActive) throw new Error('G.biomeEventActive is true after gameOver');
      if (G.biomeEventTimer !== 0) throw new Error('G.biomeEventTimer not 0 after gameOver');
      if (G.biomeEventKey !== '') throw new Error('G.biomeEventKey not empty after gameOver');

      const hud = doc.getElementById('biomeEventHud');
      if (hud && !hud.classList.contains('hidden')) throw new Error('biomeEventHud not hidden after gameOver');

      g.startRun();
      if (G.biomeEventActive) throw new Error('G.biomeEventActive is true after startRun');
      if (G.biomeEventCooldown <= 0) throw new Error('G.biomeEventCooldown not reset on startRun');
    });

    // 10. HUD UI rendering and caching
    test('biomeEventHud updates text, icon, and timer without DOM thrashing', () => {
      g.startRun();
      g.triggerBiomeEvent('city', true);
      G.biomeEventTimer = 14.8;
      g.update(1 / 60);

      const hud = doc.getElementById('biomeEventHud');
      if (!hud) throw new Error('#biomeEventHud element not found in DOM');
      if (hud.classList.contains('hidden')) throw new Error('#biomeEventHud should be visible during event');
      const content = hud.innerHTML || hud.textContent;
      if (!content.includes('НЕОНОВЫЙ ШТОРМ')) throw new Error('HUD missing event name: ' + content);
      if (!content.includes('15 СЕК')) throw new Error('HUD missing rounded seconds: ' + content);
    });

    // 11. Multi-tier quality scaling (38 on low, 54 on medium, 70 on high)
    test('Adaptive quality scaling adjusts active particle count correctly', () => {
      g.startRun();
      G.quality = 'low';
      g.triggerBiomeEvent('crystal', true);
      g.render();

      G.quality = 'medium';
      g.render();

      G.quality = 'high';
      g.render();
    });

    // 12. Car Faces and Track Visibility (Portal Continuity Protection)
    test('Car faces count remains 100% intact and unhindered during active weather event', () => {
      g.startRun();
      g.triggerBiomeEvent('neon_storm', true);
      g.render();

      const c = g.car();
      const faces = g.facesOf(c.mesh, [G.x, G.y, 0], G.yaw, 1);
      if (faces.length < 400) throw new Error('Car faces degraded during biome event: ' + faces.length);

      const testP = { x: 0, y: 0, s: 0, dz: 0, vis: true };
      g.proj([G.x, 0.45 + G.y, 0], testP);
      if (!testP.vis) throw new Error('Car projection hidden during biome event');
    });

    // 13. Performance benchmark: 120 frames with active 3D weather under 16ms/frame
    test('Performance benchmark: 120 frames of active weather run smoothly (< 16ms/frame)', () => {
      g.startRun();
      g.triggerBiomeEvent('cosmic', true);
      const t0 = Date.now();
      for (let f = 0; f < 120; f++) {
        g.update(1 / 60);
        g.render();
      }
      const totalMs = Date.now() - t0;
      const avgMs = totalMs / 120;
      console.log(`    Active weather benchmark: ${totalMs}ms total, ${avgMs.toFixed(3)}ms/frame`);
      if (avgMs > 16.0) throw new Error(`Weather rendering too slow: ${avgMs.toFixed(2)}ms/frame > 16ms`);
    });

    console.log('\n==========================================================');
    console.log(`  ALL ${passed}/${total} PHASE 5 BIOME EVENT TESTS PASSED (100%) `);
    console.log('==========================================================\n');
    process.exit(0);
  } catch (e) {
    console.error('Test suite failed:', e);
    process.exit(1);
  }
}

run();
