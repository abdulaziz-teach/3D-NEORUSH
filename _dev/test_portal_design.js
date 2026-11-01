const assert = require('assert');
const sh = require('./shim.js');

console.log('=== VERIFYING NEORUSH 3-LANE GRAND EXIT PORTAL & CINEMATIC EXIT ANIMATION ===\n');

const g = sh.sandbox.NY3D;
const G = g.G;

// Test 1: Verify MESH_PORTAL_ACTIVE (single lane) and MESH_PORTAL_EXIT (3-lane grand gateway)
console.log('Test 1: Portal Mesh Dimensions (Single Lane Active vs 3-Lane Grand Exit)');
const activeBoxes = g.ASSET_REGISTRY.getMesh('portal_active');
assert(activeBoxes, 'portal_active mesh must be registered');

let maxActiveX = 0;
for (const v of activeBoxes.v) {
  if (Math.abs(v[0]) > maxActiveX) maxActiveX = Math.abs(v[0]);
}
console.log(`  - Active portal max vertex X extent: ${maxActiveX.toFixed(3)}m (fits within lane <= 1.08m)`);
assert(maxActiveX <= 1.08, `Active portal exceeds single lane: ${maxActiveX}`);

const exitBoxes = g.ASSET_REGISTRY.getMesh('portal_exit');
assert(exitBoxes, 'portal_exit mesh must be registered');
let maxExitX = 0;
for (const v of exitBoxes.v) {
  if (Math.abs(v[0]) > maxExitX) maxExitX = Math.abs(v[0]);
}
console.log(`  - Grand Exit Portal max vertex X extent: ${maxExitX.toFixed(3)}m (must span all 3 lanes >= 3.85m)`);
assert(maxExitX >= 3.85, `Grand Exit Portal is too narrow to span all 3 lanes: ${maxExitX}`);

// Test 2: Verify clearance height (car must pass underneath comfortably)
let minExitArchY = 999;
for (const v of exitBoxes.v) {
  if (v[1] > 2.5 && v[1] < minExitArchY) minExitArchY = v[1];
}
console.log(`  - Grand Exit Portal arch clearance height: ${minExitArchY.toFixed(2)}m (must be >= 3.4m)`);
assert(minExitArchY >= 3.4, 'Arch clearance is too low for car');

// Test 3: Rendering execution without errors at various z distances
console.log('\nTest 2: drawPortalExit 3-lane rendering at various distances');
const exitObj = {
  kind: 'portal_exit',
  x: 0,
  z: 35,
  lane: 1
};
assert.doesNotThrow(() => g.drawPortalExit(exitObj), 'drawPortalExit at z=35 must not throw');
exitObj.z = 12;
assert.doesNotThrow(() => g.drawPortalExit(exitObj), 'drawPortalExit at z=12 must not throw');
exitObj.z = 4.5;
assert.doesNotThrow(() => g.drawPortalExit(exitObj), 'drawPortalExit at z=4.5 must not throw');
exitObj.z = 0.5;
assert.doesNotThrow(() => g.drawPortalExit(exitObj), 'drawPortalExit at z=0.5 must not throw');

// Test 4: Verify Single Portal Spawning on Highway (1 active portal on its lane)
console.log('\nTest 3: Single active portal spawning on highway');
G.objs.length = 0;
G.dist = 650;
G.nextPortalAt = 650;
G.inDimension = false;
G.portalSpawned = false;
g.update(0.016);

const portals = G.objs.filter(o => o.kind.startsWith('portal_'));
console.log(`  - Spawning created exactly ${portals.length} portal on the track`);
assert.strictEqual(portals.length, 1, 'Must spawn EXACTLY 1 portal on the highway');
assert.strictEqual(portals[0].kind, 'portal_active', 'The spawned portal must be portal_active');

// Test 5: Verify Hyper-warp Exit Animation execution
console.log('\nTest 4: Grand hyper-warp exit animation execution');
G.portalExitAnim = 1.2;
assert.doesNotThrow(() => g.drawPortalEntryEffect(), 'drawPortalEntryEffect during grand exit warp must not throw');
G.portalExitAnim = 0.5;
assert.doesNotThrow(() => g.drawPortalEntryEffect(), 'drawPortalEntryEffect mid-phase must not throw');
G.portalExitAnim = 0.1;
assert.doesNotThrow(() => g.drawPortalEntryEffect(), 'drawPortalEntryEffect near-end must not throw');

// Test 6: Verify 3-Lane Grand Exit Gateway allows exit from ANY lane (Lane 0, Lane 1, Lane 2)
console.log('\nTest 5: Exit Gateway collision & reward across all 3 lanes');
for (const testLane of [0, 1, 2]) {
  g.enterDimension(0);
  G.dimensionTime = 6.8;
  G.objs.length = 0;
  g.update(0.016);

  const exitPortalInObjs = G.objs.find(o => o.kind === 'portal_exit');
  assert(exitPortalInObjs, `portal_exit must be spawned for lane ${testLane}`);
  assert.strictEqual(exitPortalInObjs.x, 0, 'Grand Exit Portal must be centered at x=0');

  // Move car to test lane (0: -2.4, 1: 0, 2: 2.4)
  G.lane = testLane;
  G.x = [-2.4, 0, 2.4][testLane];

  // Drive into the mega-gateway
  exitPortalInObjs.z = 0.8;
  g.update(0.016);
  assert.strictEqual(G.inDimension, false, `Car on Lane ${testLane} (x=${G.x}) must cleanly pass through 3-lane Grand Exit Portal`);
  assert(G.portalExitAnim > 0, `Exit animation must trigger for lane ${testLane}`);
}

console.log('\n✅ ALL 3-LANE GRAND EXIT PORTAL TESTS PASSED SUCCESSFULLY!');
