// ============================================================
// CivicEstate Phase 2 E2E Test Script
//
// HOW TO RUN:
// 1. Open the CivicEstate popup (click the extension icon)
// 2. Right-click inside the popup → Inspect → Console tab
// 3. Paste this entire script into THAT console
//
// The popup console can sendMessage to the service worker.
// The service worker console CANNOT — Chrome doesn't deliver
// sendMessage to the sender's own onMessage listener.
//
// To watch API logs: also open the service worker console
// (chrome://extensions → CivicEstate → "service worker" link)
// ============================================================

(async () => {
  const log = (label, ...args) => console.log(`%c[TEST] ${label}`, 'color: cyan; font-weight: bold;', ...args);
  const pass = (name) => console.log(`%c  ✅ PASS: ${name}`, 'color: lime;');
  const fail = (name, detail) => console.log(`%c  ❌ FAIL: ${name}`, 'color: red;', detail ?? '');

  // ── STEP 1: Dump all chrome.storage.local keys ──
  log('STEP 1 — Reading all chrome.storage.local keys...');
  const allData = await chrome.storage.local.get(null);
  const allKeys = Object.keys(allData);
  log('All keys in storage:', allKeys);

  // ── STEP 2: Find the first valid Phase1Result zpid ──
  log('STEP 2 — Searching for a Phase1Result zpid...');
  const SKIP_KEYS = ['userProfile', 'profileWeights', 'batchAverages'];
  let testZpid = null;
  let phase1Obj = null;

  for (const key of allKeys) {
    if (SKIP_KEYS.includes(key)) continue;
    const val = allData[key];
    if (val && typeof val === 'object' && val.zpid && val.scores && val.commute) {
      testZpid = key;
      phase1Obj = val;
      break;
    }
  }

  if (!testZpid) {
    fail('No Phase1Result found in storage. Run Phase 1 first (navigate to a Zillow search page and click Analyze).');
    return;
  }

  log(`Found zpid: ${testZpid}`);
  log('Phase1Result object:', phase1Obj);

  // Sanity check Phase1 shape
  const p1Fields = ['zpid', 'rawAddress', 'lat', 'lon', 'scores', 'commute', 'floodZone', 'crimeGrade'];
  p1Fields.forEach(f => {
    if (f in phase1Obj) pass(`Phase1 has .${f}`);
    else fail(`Phase1 missing .${f}`);
  });

  // ── STEP 3: Fire TRIGGER_PHASE2 ──
  log('STEP 3 — Sending TRIGGER_PHASE2 message to service worker...');
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: 'TRIGGER_PHASE2', zpid: testZpid });
    log('TRIGGER_PHASE2 response:', response);
  } catch (err) {
    fail('sendMessage failed — is the service worker alive?', err.message);
    log('TIP: go to chrome://extensions, find CivicEstate, click "service worker" to wake it, then re-run this script.');
    return;
  }

  if (response?.status === 'error') {
    fail('TRIGGER_PHASE2 returned error', response.reason);
    return;
  }

  // ── STEP 4: Wait 20s then read the Phase2Result ──
  log('STEP 4 — Waiting 20 seconds for Phase 2 pipeline (Places + Elevation + Schools + Gemini)...');
  await new Promise(r => setTimeout(r, 20000));

  const updated = await chrome.storage.local.get(testZpid);
  const p2 = updated[testZpid];
  log('Phase2Result object:', p2);

  if (!p2) {
    fail('No data found at zpid after Phase 2');
    return;
  }

  // Quick check: did Phase 2 actually run, or is this still the Phase1Result?
  if (!('grocery' in p2) && !('avgSlope' in p2) && !('schools' in p2)) {
    fail('Object at zpid looks like Phase1Result still — Phase 2 may not have written back.');
    log('Check the service worker console for [CivicEstate Phase2] logs.');
    return;
  }

  // ── STEP 5: Validate Phase2Result fields ──
  log('STEP 5 — Validating Phase2Result fields...');

  // --- Gemini output ---
  if (p2.geminiOutput != null) {
    pass('geminiOutput is not null');

    const g = p2.geminiOutput;

    // scores — 5 fields
    const scoreKeys = ['lifestyle', 'accessibility', 'family', 'riskCost', 'overall'];
    const hasAllScores = scoreKeys.every(k => typeof g.scores?.[k] === 'number');
    hasAllScores ? pass('geminiOutput.scores has all 5 fields') : fail('geminiOutput.scores missing fields', g.scores);

    // scoreDeltas — 6 fields
    const deltaKeys = ['lifestyle', 'accessibility', 'family', 'riskCost', 'overall', 'sexOffenderProximityScore'];
    const hasAllDeltas = deltaKeys.every(k => typeof g.scoreDeltas?.[k] === 'number');
    hasAllDeltas ? pass('geminiOutput.scoreDeltas has all 6 fields') : fail('geminiOutput.scoreDeltas missing fields', g.scoreDeltas);

    // narrative
    typeof g.narrative === 'string' && g.narrative.length > 0
      ? pass('geminiOutput.narrative is non-empty string')
      : fail('geminiOutput.narrative', g.narrative);

    // highlights
    Array.isArray(g.highlights) && g.highlights.length > 0
      ? pass('geminiOutput.highlights is non-empty array')
      : fail('geminiOutput.highlights', g.highlights);

    // agentQuestions — exactly 3
    Array.isArray(g.agentQuestions) && g.agentQuestions.length === 3
      ? pass('geminiOutput.agentQuestions has exactly 3 items')
      : fail(`geminiOutput.agentQuestions has ${g.agentQuestions?.length} items (expected 3)`, g.agentQuestions);

    // chatContext
    typeof g.chatContext === 'string' && g.chatContext.length > 0
      ? pass('geminiOutput.chatContext is non-empty string')
      : fail('geminiOutput.chatContext', g.chatContext);

  } else {
    fail('geminiOutput is null — check service worker console for [CivicEstate gemini] errors');
  }

  // --- Nearby places (flat fields on Phase2Result) ---
  const placeKeys = ['grocery', 'pharmacy', 'park', 'hospital', 'childcare', 'school'];
  const hasAnyPlace = placeKeys.some(k => typeof p2[k] === 'number');
  hasAnyPlace
    ? pass(`nearbyPlaces: at least one category has a distance (${placeKeys.filter(k => typeof p2[k] === 'number').join(', ')})`)
    : fail('nearbyPlaces: ALL 6 categories are null — check service worker console for [CivicEstate googlePlaces] errors', placeKeys.map(k => `${k}=${p2[k]}`));

  // --- Elevation (flat fields on Phase2Result) ---
  const hasElevation = typeof p2.avgSlope === 'number' && typeof p2.maxSlope === 'number';
  hasElevation
    ? pass(`elevation: avgSlope=${p2.avgSlope}, maxSlope=${p2.maxSlope}, adaFlag=${p2.adaFlag}`)
    : fail('elevation: avgSlope or maxSlope is null — check service worker console for [CivicEstate googleElevation] errors', { avgSlope: p2.avgSlope, maxSlope: p2.maxSlope });

  // --- Schools ---
  Array.isArray(p2.schools) && p2.schools.length > 0
    ? pass(`schools: ${p2.schools.length} returned (${p2.schools.map(s => s.name).join(', ')})`)
    : fail('schools: empty or not an array', p2.schools);

  log('=== TEST RUN COMPLETE ===');
})();
