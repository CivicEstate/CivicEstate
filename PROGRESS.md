# CivicEstate — Progress

## Phase 0: Foundation ✅ COMPLETE
- [x] GitHub repo created, branches initialized (main + dev) — main exists, no dev branch created
- [x] Vite + CRXJS scaffold, npm run dev confirmed
- [x] Folder structure created, all empty files in place
- [x] manifest.json locked (permissions, content script, service worker)
- [x] All types defined in src/types/index.ts
- [x] apiKeys.ts created and gitignored, apiKeys.example.ts committed
- [x] Extension communication bridge confirmed (content ↔ background ↔ popup)

## Phase 1: Profile System ✅ COMPLETE
- [x] ProfileForm.tsx with all 9 fields
- [x] Work location geocoding via Google Maps
- [x] Profile persistence in chrome.storage.local
- [x] useProfile hook
- [x] Profile validation and defaults
- [x] Analyze button with location gate
- [x] Save confirmation toast
- [x] App.tsx shell with profile/results view state
- [x] All API host_permissions added to manifest

## Phase 2: Zillow DOM Parsing 🔧 IN PROGRESS
- [x] Page type detection (search vs detail vs other) via URL patterns
- [x] __NEXT_DATA__ script tag locator with JSON parse and root key logging
- [x] extractListings() with confirmed live path: props.pageProps.searchPageState.cat1.searchResults.listResults
- [x] Field mapping: zpid, address, latLong, unformattedPrice, beds, baths, area→sqft, zestimate, priceDelta/flag
- [x] Filters out listings missing required fields, caps at 10
- [x] Sends LISTINGS_EXTRACTED message to background with payload


## Phase 3: Phase 1 API Pipeline ✅ COMPLETE
- [x] geminiWeights.ts — calls Gemini 2.5 Flash to generate ProfileWeights from UserProfile, falls back to defaults
- [x] SAVE_PROFILE listener wired to real async geminiWeights call
- [x] phase1Pipeline.ts — mock ExtractedListing (Irvine CA), lat/lon validation, logging skeleton
- [x] LISTINGS_EXTRACTED listener — receives DOM parser payload, reads profile, runs Phase 1
- [x] TRIGGER_ANALYSIS listener — runs Phase 1 with mock listing for testing
- [x] googleMaps.ts — 4 parallel direction fetches (carPeak, carOffpeak, transit, walk), per-mode error isolation
- [x] fema.ts — NFHL ArcGIS query, flood zone → risk mapping (High/Moderate/Low/Undetermined)
- [x] calfire.ts — FHSZ ArcGIS query with SRA→LRA fallback, HAZ_CLASS extraction
- [x] fbi.ts — address parsing → ORI lookup → offense data → crimeIndex (0-100) → grade (A-F)
- [x] osm.ts — Overpass API 2km radius, weighted amenity scoring capped at 100
- [x] irvineAverages.ts — baseline Irvine scores for delta display
- [x] phase1Scores.ts — computePhase1Scores with sub-scores (commute, walk, crime, flood, wildfire, tax, priceDelta), weighted category averages, overall = 0.30/0.15/0.25/0.30
- [x] phase1Pipeline.ts wired — loads ProfileWeights, Promise.all across listings, Promise.all per listing (5 APIs), stores Phase1Result in chrome.storage by zpid
- [x] manifest.json — added api.usa.gov host permission for FBI CDE API
- [x] Build verified — vite build + tsc --noEmit pass clean

## Phase 4: Search Results Card UI 🔧 IN PROGRESS
- [x] batchAverages aggregation — Phase 1 pipeline computes mean of all 5 score fields after Promise.all, stores to chrome.storage.local as `batchAverages`

## Phase 5: Phase 2 API Pipeline 🔧 IN PROGRESS
- [x] googlePlaces.ts — 6 parallel Nearby Search fetches (grocery, pharmacy, park, hospital, childcare, school), Haversine distance in miles, per-category null fallback
- [x] googleElevation.ts — path-based elevation query (500m north, 10 samples), avgSlope/maxSlope as percentages, adaFlag (>5%), null fallback on failure
- [x] nces.ts — dual dataset: 8 IUSD schools + 8 YCJUSD schools, lat/lon bounding box selects dataset, Haversine distance sort, returns top 3 nearest, null on failure
- [x] gemini.ts — Gemini 2.5 Flash analysis with structured prompt, responseMimeType JSON, Irvine avg deltas, sex offender delta computed outside prompt, strict validation of all GeminiOutput fields, single retry on parse failure, null on total failure

## Phase 6: Detail View UI ⬜ NOT STARTED

## Phase 7: Polish + Demo Prep ⬜ NOT STARTED
