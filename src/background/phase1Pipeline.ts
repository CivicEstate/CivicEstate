import { ExtractedListing, UserProfile, ProfileWeights, Phase1Result } from '../types/index'
import { fetchCommute } from './apis/googleMaps'
import { fetchFloodZone } from './apis/fema'
import { fetchWildfireHazard } from './apis/calfire'
import { fetchCrimeData } from './apis/fbi'
import { fetchWalkability } from './apis/osm'
import { computePhase1Scores } from './scoring/phase1Scores'
import { DEFAULT_PROFILE_WEIGHTS } from './apis/geminiWeights'

// Mock listing for testing — real Irvine CA address
export const MOCK_LISTING: ExtractedListing = {
  zpid: 'mock-25432178',
  rawAddress: '100 Spectrum Center Dr, Irvine, CA 92618',
  lat: 33.6501,
  lon: -117.7428,
  price: 850000,
  beds: 3,
  baths: 2,
  sqft: 1650,
  yearBuilt: 2005,
  homeType: 'Condo',
  listingDescription: 'Modern condo near Irvine Spectrum with community pool and parks.',
  zestimate: 870000,
  priceDelta: -20000,
  annualTax: 9800,
  propertyTaxRate: 1.15,
  annualHomeownersInsurance: 1200,
  priceDeltaFlag: true,
}

export async function runPhase1Pipeline(
  listings: ExtractedListing[],
  userProfile: UserProfile
): Promise<void> {
  console.log('[CivicEstate Phase1] Starting pipeline for', listings.length, 'listings')
  console.log('[CivicEstate Phase1] User profile:', userProfile)

  // Clear stale batchAverages and old per-zpid results from previous run
  const allStorage = await chrome.storage.local.get(null)
  const keysToRemove = Object.keys(allStorage).filter((key) => {
    // Remove batchAverages and any zpid-keyed Phase1Results (numeric or mock- prefixed)
    if (key === 'batchAverages') return true
    // Zpids are numeric strings or "mock-" prefixed — don't remove config keys
    if (['userProfile', 'profileWeights', 'currentListings'].includes(key)) return false
    const val = allStorage[key]
    if (val && typeof val === 'object' && 'scores' in val) return true
    return false
  })
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove)
    console.log('[CivicEstate Phase1] Cleared', keysToRemove.length, 'stale keys from storage')
  }

  const validated: ExtractedListing[] = []

  for (const listing of listings) {
    if (!listing.lat || !listing.lon || listing.lat === 0 || listing.lon === 0) {
      console.warn('[CivicEstate Phase1] UNVERIFIED — missing lat/lon, skipping zpid:', listing.zpid)
      continue
    }
    validated.push(listing)
  }

  console.log('[CivicEstate Phase1] Validated', validated.length, 'of', listings.length, 'listings')

  if (validated.length === 0) {
    console.warn('[CivicEstate Phase1] No valid listings to process')
    return
  }

  // Load profile weights from storage (set during SAVE_PROFILE)
  const weights = await new Promise<ProfileWeights>((resolve) => {
    chrome.storage.local.get('profileWeights', (result) => {
      resolve((result.profileWeights as ProfileWeights) ?? DEFAULT_PROFILE_WEIGHTS)
    })
  })

  console.log('[CivicEstate Phase1] Using weights:', weights)

  // Process all listings in parallel
  const allScores = await Promise.all(validated.map((listing) => processListing(listing, userProfile, weights)))

  // Compute batch averages for UI deltas
  const validScores = allScores.filter((s): s is Phase1Result['scores'] => s !== null)
  if (validScores.length > 0) {
    const batchAverages = {
      lifestyle: Math.round(validScores.reduce((sum, s) => sum + s.lifestyle, 0) / validScores.length * 10) / 10,
      accessibility: Math.round(validScores.reduce((sum, s) => sum + s.accessibility, 0) / validScores.length * 10) / 10,
      family: Math.round(validScores.reduce((sum, s) => sum + s.family, 0) / validScores.length * 10) / 10,
      riskCost: Math.round(validScores.reduce((sum, s) => sum + s.riskCost, 0) / validScores.length * 10) / 10,
      overall: Math.round(validScores.reduce((sum, s) => sum + s.overall, 0) / validScores.length * 10) / 10,
    }
    await chrome.storage.local.set({ batchAverages })
    console.log('[CivicEstate Phase1] batchAverages:', batchAverages)
  }

  console.log('[CivicEstate Phase1] Pipeline complete for', validated.length, 'listings')
}

async function processListing(
  listing: ExtractedListing,
  profile: UserProfile,
  weights: ProfileWeights
): Promise<Phase1Result['scores'] | null> {
  try {
    console.log('[CivicEstate Phase1] Processing:', listing.zpid, listing.rawAddress)

    // Fire all 5 APIs in parallel — each wrapped so no single failure kills the listing
    const [commuteResult, floodResult, wildfireResult, crimeResult, walkResult] = await Promise.all([
      fetchCommute(listing.lat, listing.lon, profile.workLat, profile.workLon)
        .catch((e) => { console.error('[CivicEstate Phase1] commute failed:', e); return { carPeak: null, carOffpeak: null, transit: null, walk: null } }),
      fetchFloodZone(listing.lat, listing.lon)
        .catch((e) => { console.error('[CivicEstate Phase1] flood failed:', e); return { floodZone: null, floodRisk: null } }),
      fetchWildfireHazard(listing.lat, listing.lon)
        .catch((e) => { console.error('[CivicEstate Phase1] wildfire failed:', e); return { wildfireHazard: null } }),
      fetchCrimeData(listing.rawAddress)
        .catch((e) => { console.error('[CivicEstate Phase1] crime failed:', e); return { crimeGrade: null, crimeIndex: null } }),
      fetchWalkability(listing.lat, listing.lon)
        .catch((e) => { console.error('[CivicEstate Phase1] walk failed:', e); return { osmWalkabilityScore: null } }),
    ])

    console.log('[CivicEstate Phase1] Raw API results for', listing.zpid, {
      commute: commuteResult,
      flood: floodResult,
      wildfire: wildfireResult,
      crime: crimeResult,
      walkability: walkResult,
    })

    // Compute scores
    const scores = computePhase1Scores(
      {
        commute: commuteResult,
        osmWalkabilityScore: walkResult.osmWalkabilityScore,
        crimeGrade: crimeResult.crimeGrade,
        crimeIndex: crimeResult.crimeIndex,
        floodRisk: floodResult.floodRisk,
        wildfireHazard: wildfireResult.wildfireHazard,
        annualTax: listing.annualTax,
        price: listing.price,
        priceDelta: listing.priceDelta,
      },
      profile,
      weights
    )

    // Build Phase1Result
    const phase1Result: Phase1Result = {
      ...listing,
      lat: listing.lat,
      lon: listing.lon,
      annualTax: listing.annualTax ?? 0,
      yearBuilt: listing.yearBuilt ?? 0,
      priceDelta: listing.priceDelta ?? 0,
      priceDeltaFlag: listing.priceDeltaFlag,
      commute: commuteResult,
      floodZone: floodResult.floodZone,
      floodRisk: floodResult.floodRisk,
      wildfireHazard: wildfireResult.wildfireHazard,
      crimeGrade: crimeResult.crimeGrade,
      crimeIndex: crimeResult.crimeIndex,
      osmWalkabilityScore: walkResult.osmWalkabilityScore,
      scores,
    }

    // Store in chrome.storage keyed by zpid
    await chrome.storage.local.set({ [listing.zpid]: phase1Result })
    console.log('[CivicEstate Phase1] Stored result for', listing.zpid, 'scores:', scores)

    // Notify popup that this listing's result is ready
    chrome.runtime.sendMessage({ type: 'PHASE1_RESULT_READY', zpid: listing.zpid }).catch(() => {})

    return scores
  } catch (error) {
    console.error('[CivicEstate Phase1] Failed to process listing:', listing.zpid, error)
    return null
  }
}
