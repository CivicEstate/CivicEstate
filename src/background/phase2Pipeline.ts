import { Phase1Result, Phase2Result, UserProfile } from '../types/index'
import { fetchNearbyPlaces, NearbyPlacesResult } from './apis/googlePlaces'
import { fetchElevationData, ElevationResult } from './apis/googleElevation'
import { fetchNearbySchools, SchoolEntry } from './apis/nces'
import { runGeminiAnalysis } from './apis/gemini'
import { parseListingDescription } from '../utils/domParser'

export async function runPhase2Pipeline(
  phase1Result: Phase1Result,
  userProfile: UserProfile
): Promise<Phase2Result> {
  const { lat, lon } = phase1Result

  console.log('[CivicEstate Phase2] Starting pipeline for', phase1Result.zpid)

  // Fire all four calls in parallel — each wrapped so Promise.all never rejects
  const [placesResult, elevationResult, schoolsResult, textFlags] = await Promise.all([
    fetchNearbyPlaces(lat, lon).catch((_err: unknown): null => {
      console.warn('[CivicEstate Phase2] fetchNearbyPlaces failed:', _err)
      return null
    }),
    fetchElevationData(lat, lon).catch((_err: unknown): null => {
      console.warn('[CivicEstate Phase2] fetchElevationData failed:', _err)
      return null
    }),
    fetchNearbySchools(lat, lon).catch((_err: unknown): null => {
      console.warn('[CivicEstate Phase2] fetchNearbySchools failed:', _err)
      return null
    }),
    Promise.resolve(parseListingDescription(phase1Result.listingDescription)),
  ]) as [NearbyPlacesResult | null, ElevationResult | null, SchoolEntry[] | null, ReturnType<typeof parseListingDescription>]

  // Build Phase2Result — spread Phase1 fields, layer Phase2 on top
  const phase2Result: Phase2Result = {
    ...phase1Result,
    grocery: placesResult?.grocery ?? null,
    pharmacy: placesResult?.pharmacy ?? null,
    park: placesResult?.park ?? null,
    hospital: placesResult?.hospital ?? null,
    childcare: placesResult?.childcare ?? null,
    school: placesResult?.school ?? null,
    avgSlope: elevationResult?.avgSlope ?? null,
    maxSlope: elevationResult?.maxSlope ?? null,
    adaFlag: elevationResult?.adaFlag ?? false,
    listingMentionsStairs: textFlags.listingMentionsStairs,
    listingMentionsElevator: textFlags.listingMentionsElevator,
    schools: schoolsResult ?? [],
    geminiOutput: null,
    // TODO: sex offender registry API not available in demo — fields null by default
    sexOffenderCount: null,
    sexOffenderNearestMi: null,
    sexOffenderProximityScore: null,
  }

  console.log('[CivicEstate Phase2] Data assembled, calling Gemini')

  // Gemini analysis — runs after all data is assembled
  const geminiOutput = await runGeminiAnalysis(phase2Result, userProfile).catch(
    (err: unknown) => {
      console.error('[CivicEstate Phase2] runGeminiAnalysis failed:', err)
      return null
    }
  )

  if (geminiOutput) {
    phase2Result.geminiOutput = geminiOutput
    phase2Result.scores = geminiOutput.scores
  }
  // Fallback: geminiOutput stays null, phase1Result formula scores remain on .scores

  console.log('[CivicEstate Phase2] Pipeline complete for', phase1Result.zpid, {
    hasGemini: !!geminiOutput,
    scores: phase2Result.scores,
  })

  return phase2Result
}
