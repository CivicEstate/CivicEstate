# CivicEstate — Progress

## Phase 0: Foundation ⬜ NOT STARTED
- [ ] GitHub repo created, branches initialized (main + dev)
- [ ] Vite + CRXJS scaffold, npm run dev confirmed
- [ ] Folder structure created, all empty files in place
- [ ] manifest.json locked (permissions, content script, service worker)
- [ ] All types defined in src/types/index.ts
- [ ] apiKeys.ts created and gitignored, apiKeys.example.ts committed
- [ ] Extension communication bridge confirmed (content ↔ background ↔ popup)

## Phase 1: Profile System ⬜ NOT STARTED
- [ ] ProfileForm.tsx with all 9 fields
- [ ] Work location geocoding via Google Maps
- [ ] Profile persistence in chrome.storage.local
- [ ] useProfile hook
- [ ] Profile validation and defaults

## Phase 2: Zillow DOM Parsing ⬜ NOT STARTED
- [ ] Search page vs listing page detection
- [ ] __NEXT_DATA__ extraction
- [ ] Listing data mapped to ExtractedListing type (cap at 10)
- [ ] Handoff to background.js via chrome.runtime.sendMessage
- [ ] Analyze button trigger confirmed

## Phase 3: Phase 1 API Pipeline ⬜ NOT STARTED
- [ ] melissa.ts (Address Verify → Geocoder → Property V4)
- [ ] googleMaps.ts (commute times)
- [ ] fema.ts (flood zone)
- [ ] calfire.ts (wildfire hazard)
- [ ] fbi.ts (crime grade + index)
- [ ] osm.ts (walkability score)
- [ ] Promise.all wiring in phase1Pipeline.ts
- [ ] Formula scores in phase1Scores.ts
- [ ] Irvine averages hardcoded in irvineAverages.ts
- [ ] Phase1Result written to chrome.storage per zpid

## Phase 4: Search Results Card UI ⬜ NOT STARTED
- [ ] App.tsx shell (profile view + results view)
- [ ] PropertyCard.tsx with 5 scores + key stats
- [ ] Skeleton loading states
- [ ] ScoreBadge.tsx with color scale + delta display
- [ ] Cards populate as Phase 1 resolves (not all at once)

## Phase 5: Phase 2 API Pipeline ⬜ NOT STARTED
- [ ] googlePlaces.ts (full amenity breakdown)
- [ ] googleElevation.ts (slope + ADA flag)
- [ ] nces.ts (top 3 schools)
- [ ] Listing text pattern matching in domParser.ts
- [ ] Promise.all wiring in phase2Pipeline.ts
- [ ] gemini.ts (strict JSON output, retry on parse fail)
- [ ] Phase2Result written to chrome.storage per zpid

## Phase 6: Detail View UI ⬜ NOT STARTED
- [ ] DetailView.tsx shell (Phase 1 top, Gemini bottom)
- [ ] Phase 1 stats section (property header, commute, risk, walkability)
- [ ] Gemini output section (scores, narrative, highlights, agent questions)
- [ ] ChatFooter.tsx with chatContext-grounded responses
- [ ] Back navigation preserving card state

## Phase 7: Polish + Demo Prep ⬜ NOT STARTED
- [ ] Full error handling pass (all API fallbacks confirmed)
- [ ] WCAG 2.1 AA pass (ARIA, keyboard nav, contrast, high contrast mode)
- [ ] UI polish (400px popup, loading text, score bar animations)
- [ ] Demo flow rehearsed 3x without errors
- [ ] API keys confirmed not in any committed file
- [ ] README setup instructions complete