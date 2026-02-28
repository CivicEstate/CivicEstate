CLAUDE.md
CivicEstate - Chrome extension overlaying personalized lifestyle and accessibility intelligence onto Zillow listings using real APIs and AI.
PROGRESS.md tracks completed phases and current status.
UPDATe PROGRESS.MD appends what you actually built to PROGRESS.md under whatever phase youare in. do not make. aparticular progress.md phase too lengthy. 

Project Structure
civicestate/
├── src/
│   ├── background/
│   │   ├── index.ts
│   │   ├── phase1Pipeline.ts
│   │   ├── phase2Pipeline.ts
│   │   ├── apis/
│   │   │   ├── melissa.ts
│   │   │   ├── googleMaps.ts
│   │   │   ├── googlePlaces.ts
│   │   │   ├── googleElevation.ts
│   │   │   ├── fema.ts
│   │   │   ├── calfire.ts
│   │   │   ├── fbi.ts
│   │   │   ├── osm.ts
│   │   │   ├── nces.ts
│   │   │   └── gemini.ts
│   │   └── scoring/
│   │       ├── phase1Scores.ts
│   │       └── irvineAverages.ts
│   ├── content/
│   │   └── index.ts
│   ├── popup/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ProfileForm.tsx
│   │       ├── PropertyCard.tsx
│   │       ├── DetailView.tsx
│   │       ├── ScoreBadge.tsx
│   │       ├── ChatFooter.tsx
│   │       └── LoadingStates.tsx
│   ├── constants/
│   │   └── apiKeys.ts          // gitignored — never commit real keys
│   ├── types/
│   │   └── index.ts            // source of truth for all types
│   └── utils/
│       ├── scoring.ts
│       └── domParser.ts
├── manifest.json
├── vite.config.ts
├── tsconfig.json
├── CLAUDE.md
├── PROGRESS.md
└── package.json

Types

Location: src/types/index.ts — source of truth for all types
Key types: UserProfile, ExtractedListing, Phase1Result, Phase2Result, GeminiOutput, CardState
Never redefine types inline in components or API files — always import from types/index.ts
When implementing any feature, read src/types/index.ts first


Development Philosophy
KISS + YAGNI + Sequential Phases

Simple solutions first
Build only what is needed right now
Do not skip phases — each validates assumptions for the next
Get it working before making it clean


Critical Rules
Background Service Worker

All API calls happen in background/index.ts — never call external APIs from popup or content scripts directly
API keys live in src/constants/apiKeys.ts only — this file is gitignored
Melissa runs first and gates everything — if it fails for a listing, skip that listing without blocking others
Phase 1 runs on all extracted listings in parallel via Promise.all
Phase 2 runs only on the one listing the user clicks — never batch Phase 2

Chrome Storage

User profile: chrome.storage.local key userProfile — persists across sessions
Phase 1 results: chrome.storage.local key per zpid — temporary, current session only
Components never touch chrome.storage directly — all reads and writes go through hooks or background messages

Gemini Output

Always strict JSON — no markdown, no preamble
Required fields: scores, scoreDeltas, narrative, highlights, agentQuestions, chatContext
If response cannot be parsed as valid JSON, retry once automatically
If retry fails, return formula-based scores and raw highlights without narrative — never crash

DOM Parsing

Always try __NEXT_DATA__ JSON blob first
Fall back to data-testid attributes
Final fallback: JSON-LD structured data blocks
Never target CSS class names — Zillow randomizes them on deploys
Hard cap at 10 extracted listings regardless of page count


Two-Phase Pipeline
Phase 1 — fires for all extracted listings in parallel
Melissa (address verify + geocoder + property V4) → then simultaneously: Google Maps Directions, FEMA, CalFire, FBI Crime, OSM Overpass. Returns formula-based scores. No Gemini.
Phase 2 — fires only for the listing the user clicks
Reads Phase 1 data from chrome.storage (no re-fetching). Adds: Google Places, Google Elevation, NCES schools, listing text pattern matching. Then Gemini 2.5 Flash over the full data vector. Returns AI-generated scores, narrative, highlights, agent questions, chatContext.

Error Handling — Define Fallbacks Before Happy Path
Every API must have a defined degraded state before its success case is built.

Melissa failure on a listing → mark card UNVERIFIED, skip, do not block batch
Google Maps failure → commute shows "Unavailable", neutral score contribution
FEMA failure → flood zone shows "Unknown", neutral score contribution
CalFire failure → wildfire shows "Unknown", neutral score contribution
FBI failure → crime shows "Unavailable", neutral score contribution
Gemini failure → formula scores + raw data highlights, retry button shown
Zero listings extracted → clear message: "No listings found — navigate to a Zillow search results page"
No single API failure should crash the popup or block other listings


API Keys

Real keys: src/constants/apiKeys.ts — in .gitignore, never committed
Template: src/constants/apiKeys.example.ts — committed, empty string values
Keys needed: MELISSA_API_KEY, GOOGLE_MAPS_KEY, GOOGLE_PLACES_KEY, GOOGLE_ELEVATION_KEY, FBI_API_KEY, GEMINI_API_KEY


Scores Reference
Phase 1 — formula-based
Lifestyle Fit, Accessibility, Family-Friendliness, Risk/Cost, Overall — all 0–10, weighted averages of raw Phase 1 signals, profile-adjusted.
Phase 2 — Gemini AI-generated
Same four scores plus Overall, now reasoned by Gemini over the full data vector. Each displayed with ▲/▼ delta vs. hardcoded Irvine averages in scoring/irvineAverages.ts.

When to Stop and Reassess

Zillow's __NEXT_DATA__ structure has changed and extraction returns empty
Gemini consistently fails to return valid JSON after retry
Google Places or Maps rate limits are being hit during normal demo flow
Any API key is accidentally committed to git


Git Workflow
Branches: phase-X/feature-name (e.g. phase-0/foundation, phase-3/melissa-pipeline)
Commit format: feat(scope): subject — types: feat, fix, docs, refactor, chore
Never include "claude code", "written by claude", or "AI-generated" in commits
Never commit src/constants/apiKeys.ts

Remember: Phase order matters. DOM parsing and the Phase 1 API pipeline are the highest-risk items — give them the most time. Everything else builds on those two working correctly.