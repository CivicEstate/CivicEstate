// ═══════════════════════════════════════════════════════════════
// CivicEstate E2E Smoke Test — paste into SERVICE WORKER console
// ═══════════════════════════════════════════════════════════════
//
// How to open:
//   chrome://extensions → CivicEstate → "Inspect views: service worker"
//
// Prerequisites:
//   1. Navigate to a Zillow search results page (e.g. Irvine CA homes for sale)
//   2. Wait for listings to load and CivicEstate panels to appear
//   3. A userProfile must already be saved (run the popup ProfileForm first)
//   4. Paste this script into the service worker DevTools console

(async () => {
  const fails = [];
  const log = (msg) => console.log(`%c[CE-TEST] ${msg}`, 'color:#6366f1;font-weight:bold');
  const pass = (name) => console.log(`%c  ✓ PASS: ${name}`, 'color:#22c55e;font-weight:bold');
  const fail = (name, detail) => {
    console.log(`%c  ✗ FAIL: ${name}`, 'color:#ef4444;font-weight:bold', detail ?? '');
    fails.push(name);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── STEP 1: Confirm background is alive ──────────────────
  log('STEP 1 — Confirm background is alive');
  try {
    const allData = await chrome.storage.local.get(null);
    const hasProfile = !!allData.userProfile;
    log(`  userProfile present: ${hasProfile}`);
    hasProfile ? pass('userProfile exists in storage') : fail('userProfile exists in storage');

    if (!hasProfile) {
      log('ABORTING — save a profile via the popup first.');
      return;
    }
    pass('Background service worker is alive');
  } catch (e) {
    fail('Background service worker is alive', e.message);
    return;
  }

  // ── STEP 2: Trigger Phase 1 via TRIGGER_ANALYSIS ─────────
  log('STEP 2 — Sending TRIGGER_ANALYSIS...');
  const analysisResp = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TRIGGER_ANALYSIS' }, resolve);
  });
  log(`  Response: ${JSON.stringify(analysisResp)}`);
  if (analysisResp?.status === 'phase1-started' || analysisResp?.status === 'error') {
    pass('TRIGGER_ANALYSIS responded');
  } else {
    fail('TRIGGER_ANALYSIS responded', analysisResp);
  }

  // ── STEP 3: Wait 10s, read storage, find zpid ───────────
  log('STEP 3 — Waiting 10s for Phase 1 results...');
  await sleep(10000);

  const allData = await chrome.storage.local.get(null);
  const allKeys = Object.keys(allData);
  log(`  Storage keys (${allKeys.length}): ${allKeys.join(', ')}`);

  const zpidKeys = allKeys.filter((k) => /^\d{5,}$/.test(k));
  log(`  zpid keys found: ${zpidKeys.length} — ${zpidKeys.join(', ')}`);

  if (zpidKeys.length === 0) {
    fail('Found at least one zpid in storage');
    log('ABORTING — no zpid to test Phase 2 against. Make sure you are on a Zillow search page with listings.');
    return;
  }

  const testZpid = zpidKeys[0];
  const phase1 = allData[testZpid];
  log(`  Using zpid: ${testZpid}`);
  log(`  Phase1Result scores: ${JSON.stringify(phase1?.scores)}`);
  console.log('  Full Phase1Result:', phase1);

  if (phase1?.scores) {
    pass('Phase1Result has scores');
  } else {
    fail('Phase1Result has scores');
  }

  // ── STEP 4: Trigger Phase 2 ─────────────────────────────
  log(`STEP 4 — Sending TRIGGER_PHASE2 for zpid ${testZpid}`);
  const p2Resp = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TRIGGER_PHASE2', zpid: testZpid }, resolve);
  });
  log(`  Response: ${JSON.stringify(p2Resp)}`);
  if (p2Resp?.status === 'phase2-complete') {
    pass('Phase 2 sendMessage response');
  } else {
    fail('Phase 2 sendMessage response', p2Resp);
  }

  // ── STEP 5: Wait 20s, validate Phase2Result ─────────────
  log('STEP 5 — Waiting 20s for Gemini + storage write...');
  await sleep(20000);

  const p2Data = await chrome.storage.local.get(testZpid);
  const r = p2Data[testZpid];
  console.log('  Full Phase2Result:', r);

  if (!r) {
    fail('Phase2Result exists in storage');
    log('ABORTING — no result after Phase 2.');
    return;
  }

  // geminiOutput not null
  if (r.geminiOutput != null) {
    pass('geminiOutput is not null');
  } else {
    fail('geminiOutput is not null');
  }

  const g = r.geminiOutput;
  if (g) {
    // scores — 5 fields
    const scoreKeys = ['lifestyle', 'accessibility', 'family', 'riskCost', 'overall'];
    const hasAllScores = scoreKeys.every((k) => typeof g.scores?.[k] === 'number');
    hasAllScores ? pass('geminiOutput.scores has all 5 fields') : fail('geminiOutput.scores has all 5 fields', g.scores);

    // scoreDeltas — 6 fields
    const deltaKeys = [...scoreKeys, 'sexOffenderProximityScore'];
    const hasAllDeltas = deltaKeys.every((k) => typeof g.scoreDeltas?.[k] === 'number');
    hasAllDeltas ? pass('geminiOutput.scoreDeltas has all 6 fields') : fail('geminiOutput.scoreDeltas has all 6 fields', g.scoreDeltas);

    // narrative
    typeof g.narrative === 'string' && g.narrative.length > 0
      ? pass('geminiOutput.narrative is non-empty string')
      : fail('geminiOutput.narrative is non-empty string', g.narrative);

    // highlights — 4-7 items
    const hLen = g.highlights?.length ?? 0;
    hLen >= 4 && hLen <= 7
      ? pass(`geminiOutput.highlights has ${hLen} items (4-7)`)
      : fail(`geminiOutput.highlights has ${hLen} items (expected 4-7)`, g.highlights);

    // agentQuestions — exactly 1
    const aqLen = g.agentQuestions?.length ?? 0;
    aqLen === 1
      ? pass('geminiOutput.agentQuestions has exactly 1 item')
      : fail(`geminiOutput.agentQuestions has ${aqLen} items (expected 1)`, g.agentQuestions);

    // chatContext
    typeof g.chatContext === 'string' && g.chatContext.length > 0
      ? pass('geminiOutput.chatContext is non-empty string')
      : fail('geminiOutput.chatContext is non-empty string', g.chatContext);
  }

  // nearbyPlaces — check any of grocery/pharmacy/park/hospital are non-null
  const hasPlaces = [r.grocery, r.pharmacy, r.park, r.hospital].some((v) => v !== null);
  hasPlaces ? pass('nearbyPlaces (at least one distance present)') : fail('nearbyPlaces is not null');

  // elevationData
  const hasElevation = r.avgSlope !== null || r.maxSlope !== null;
  hasElevation ? pass('elevationData is not null') : fail('elevationData is not null');

  // nearbySchools — exactly 3
  const schoolCount = r.schools?.length ?? 0;
  schoolCount === 3
    ? pass(`nearbySchools has exactly 3 items`)
    : fail(`nearbySchools has ${schoolCount} items (expected 3)`, r.schools);

  // ── STEP 6: Final verdict ───────────────────────────────
  console.log('');
  if (fails.length === 0) {
    console.log(
      '%c ══ ALL CHECKS PASSED ══ ',
      'background:#22c55e;color:#fff;font-size:16px;font-weight:bold;padding:8px 16px;border-radius:4px'
    );
  } else {
    console.log(
      `%c ══ ${fails.length} CHECK(S) FAILED ══ `,
      'background:#ef4444;color:#fff;font-size:16px;font-weight:bold;padding:8px 16px;border-radius:4px'
    );
    fails.forEach((f, i) => console.log(`%c  ${i + 1}. ${f}`, 'color:#ef4444'));
  }
})();
