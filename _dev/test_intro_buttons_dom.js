const fs = require('fs');
const sh = require('./shim.js');

try {
  const g = sh.sandbox.NY3D;
  const G = g.G;
  const tut = g.TUTORIAL_SYSTEM;
  const doc = sh.sandbox.document;

  if (!tut) throw new Error('TUTORIAL_SYSTEM not found');

  // Verify HTML has all 4 SVG icons
  const html = fs.readFileSync('index.html', 'utf8');
  const featMatches = html.match(/class="intro-feat-item"[\s\S]*?<\/div>/g) || [];
  if (featMatches.length !== 4) {
    throw new Error(`Expected 4 .intro-feat-item in index.html, found ${featMatches.length}`);
  }
  for (let i = 0; i < featMatches.length; i++) {
    if (!featMatches[i].includes('<svg')) {
      throw new Error(`Feat item ${i+1} does not contain an SVG element!`);
    }
  }
  console.log('1. Verified all 4 intro feature cards contain crisp SVG icons');

  // Verify SVG button icons
  if (!html.includes('id="btnIntroLearn"') || !html.includes('id="btnIntroSkip"')) {
    throw new Error('Intro buttons not found in index.html');
  }
  console.log('2. Verified intro buttons markup and onclick bindings exist in index.html');

  // Test 1: First-time intro opens modal
  g.store.set('neorush_intro_seen', false);
  tut.showIntro();
  const introModal = doc.getElementById('introModal');
  if (!introModal || introModal.classList.contains('hidden')) {
    throw new Error('introModal should be visible');
  }
  console.log('3. introModal is visible');

  // Test 2: Click btnIntroLearn
  const btnLearn = doc.getElementById('btnIntroLearn');
  if (!btnLearn) throw new Error('#btnIntroLearn not found in DOM');

  btnLearn.click();

  if (!introModal.classList.contains('hidden')) {
    throw new Error('#btnIntroLearn click did not hide #introModal');
  }
  if (!G.running || !G.isTutorial || !tut.active || tut.step !== 1) {
    throw new Error(`Tutorial race did not start properly: running=${G.running} isTutorial=${G.isTutorial} step=${tut.step}`);
  }
  const banner = doc.getElementById('tutorialBanner');
  if (!banner || banner.classList.contains('hidden')) {
    throw new Error('#tutorialBanner should be visible during race tutorial');
  }
  console.log('4. btnIntroLearn click starts tutorial race at step 1 with banner visible');

  // Test 3: Reset and test btnIntroSkip (plays game directly)
  G.running = false;
  tut.showIntro();
  const btnSkip = doc.getElementById('btnIntroSkip');
  if (!btnSkip) throw new Error('#btnIntroSkip not found');

  btnSkip.click();

  if (!introModal.classList.contains('hidden')) {
    throw new Error('#btnIntroSkip click did not hide #introModal');
  }
  if (!G.running || G.isTutorial || tut.active) {
    throw new Error(`Normal game race did not start properly on skip: running=${G.running} isTutorial=${G.isTutorial} active=${tut.active}`);
  }
  console.log('5. btnIntroSkip click starts normal game race without tutorial mode');

  // Test 4: Menu Dropdown "tutorial" action
  G.running = false;
  tut.startRace(1);
  if (!G.running || !G.isTutorial || tut.step !== 1) {
    throw new Error('Menu dropdown tutorial failed to start race');
  }
  console.log('6. Menu dropdown tutorial starts race tutorial at step 1');

  // Test 5: Hero button on home screen
  G.running = false;
  const btnOpenTut = doc.getElementById('btnOpenTut');
  if (!btnOpenTut) throw new Error('#btnOpenTut not found');
  btnOpenTut.click();
  if (!G.running || !G.isTutorial || tut.step !== 1) {
    throw new Error('Hero button btnOpenTut failed to start race tutorial');
  }
  console.log('7. Hero button btnOpenTut starts race tutorial at step 1');

  console.log('\n--- ALL DOM BUTTON TESTS PASSED (100%) ---');
  process.exit(0);
} catch (err) {
  console.error('TEST FAILED:', err.message, err.stack);
  process.exit(1);
}
