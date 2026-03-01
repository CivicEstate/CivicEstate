import { Phase2Result, UserProfile, GeminiOutput } from '../../types/index'
import { GEMINI_API_KEY } from '../../constants/apiKeys'
import { IRVINE_AVERAGES } from '../scoring/irvineAverages'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

function buildSystemPrompt(): string {
  return [
    'You are a real-estate analyst for a Chrome extension called CivicEstate.',
    'Reason step by step before producing output.',
    'Cite real numbers from the data provided.',
    'Identify tensions specific to this user profile.',
    'Only reference zestimate, annualTax, or propertyTaxRate if they are not null in the data.',
    'Do not reference sex offender data under any circumstance.',
    'Output strict JSON only — no markdown fences, no preamble, no explanation outside the JSON object.',
  ].join(' ')
}

function buildUserPrompt(data: Phase2Result, profile: UserProfile): string {
  const financials: Record<string, unknown> = {}
  if (data.zestimate != null) financials.zestimate = data.zestimate
  if (data.annualTax != null) financials.annualTax = data.annualTax
  if (data.propertyTaxRate != null) financials.propertyTaxRate = data.propertyTaxRate

  const payload = {
    listing: {
      address: data.rawAddress,
      price: data.price,
      beds: data.beds,
      baths: data.baths,
      sqft: data.sqft,
      yearBuilt: data.yearBuilt,
      homeType: data.homeType,
      ...financials,
      priceDelta: data.priceDelta,
      priceDeltaFlag: data.priceDeltaFlag,
      annualHomeownersInsurance: data.annualHomeownersInsurance,
    },
    commute: data.commute,
    floodZone: data.floodZone,
    floodRisk: data.floodRisk,
    wildfireHazard: data.wildfireHazard,
    crimeGrade: data.crimeGrade,
    crimeIndex: data.crimeIndex,
    osmWalkabilityScore: data.osmWalkabilityScore,
    nearbyPlaces: {
      grocery: data.grocery,
      pharmacy: data.pharmacy,
      park: data.park,
      hospital: data.hospital,
      childcare: data.childcare,
      school: data.school,
    },
    elevation: {
      avgSlope: data.avgSlope,
      maxSlope: data.maxSlope,
      adaFlag: data.adaFlag,
    },
    accessibilityFlags: {
      listingMentionsStairs: data.listingMentionsStairs,
      listingMentionsElevator: data.listingMentionsElevator,
    },
    schools: data.schools,
    phase1Scores: data.scores,
    userProfile: profile,
    irvineAverages: IRVINE_AVERAGES,
  }

  return [
    'Analyze this property for the given user profile.',
    'Irvine averages are provided — compute scoreDeltas as (your score minus Irvine average), rounded to 1 decimal.',
    '',
    'DATA:',
    JSON.stringify(payload),
    '',
    'Return a single JSON object with exactly these fields:',
    '- scores: { lifestyle: number 0-10, accessibility: number 0-10, family: number 0-10, riskCost: number 0-10, overall: number 0-10 }',
    '- scoreDeltas: { lifestyle: number, accessibility: number, family: number, riskCost: number, overall: number }',
    '- narrative: exactly 3 sentences citing real numbers from the data',
    '- highlights: string array, each prefixed with one of ✅ ❌ ⚠️ 💰',
    '- agentQuestions: exactly 3 strings a buyer should ask their agent',
    '- chatContext: one dense paragraph summarizing all fetched facts for later chat use',
  ].join('\n')
}

function validateOutput(obj: unknown): GeminiOutput | null {
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>

  // scores
  const scores = o.scores as Record<string, unknown> | undefined
  if (!scores || typeof scores !== 'object') return null
  for (const k of ['lifestyle', 'accessibility', 'family', 'riskCost', 'overall']) {
    if (typeof scores[k] !== 'number') return null
  }

  // scoreDeltas
  const deltas = o.scoreDeltas as Record<string, unknown> | undefined
  if (!deltas || typeof deltas !== 'object') return null
  for (const k of ['lifestyle', 'accessibility', 'family', 'riskCost', 'overall']) {
    if (typeof deltas[k] !== 'number') return null
  }

  // narrative
  if (typeof o.narrative !== 'string' || o.narrative.length === 0) return null

  // highlights
  if (!Array.isArray(o.highlights) || o.highlights.length === 0) return null
  if (!o.highlights.every((h: unknown) => typeof h === 'string')) return null

  // agentQuestions
  if (!Array.isArray(o.agentQuestions) || o.agentQuestions.length === 0) return null
  if (!o.agentQuestions.every((q: unknown) => typeof q === 'string')) return null

  // chatContext
  if (typeof o.chatContext !== 'string' || o.chatContext.length === 0) return null

  return obj as GeminiOutput
}

async function callGemini(data: Phase2Result, profile: UserProfile): Promise<unknown> {
  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt() }] },
    contents: [{ parts: [{ text: buildUserPrompt(data, profile) }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  }

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`[CivicEstate gemini] HTTP ${res.status}:`, await res.text())
    return null
  }

  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    console.error('[CivicEstate gemini] No text in response:', json)
    return null
  }

  return JSON.parse(text)
}

function applySexOffenderDelta(
  output: GeminiOutput,
  data: Phase2Result
): GeminiOutput {
  const baseline = 5
  const score = data.sexOffenderProximityScore ?? baseline
  output.scoreDeltas.sexOffenderProximityScore = Math.round((score - baseline) * 10) / 10
  return output
}

export async function runGeminiAnalysis(
  phase2Data: Phase2Result,
  profile: UserProfile
): Promise<GeminiOutput | null> {
  try {
    // Attempt 1
    let raw = await callGemini(phase2Data, profile)
    let result = validateOutput(raw)

    // Retry once if parse/validation failed
    if (!result) {
      console.warn('[CivicEstate gemini] First attempt failed, retrying...')
      raw = await callGemini(phase2Data, profile)
      result = validateOutput(raw)
    }

    if (!result) {
      console.error('[CivicEstate gemini] Both attempts failed')
      return null
    }

    applySexOffenderDelta(result, phase2Data)
    console.log('[CivicEstate gemini] analysis result:', result)
    return result
  } catch (err) {
    console.error('[CivicEstate gemini] runGeminiAnalysis failed:', err)
    return null
  }
}
