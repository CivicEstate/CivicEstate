import { Phase2Result, UserProfile, GeminiOutput } from '../../types/index'
import { GEMINI_API_KEY } from '../../constants/apiKeys'
import { IRVINE_AVERAGES } from '../scoring/irvineAverages'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`

const MODE_LABELS: Record<UserProfile['mode'], string> = { drives: 'Drives', transit: 'Transit', walk: 'Walks' }
const REMOTE_LABELS: Record<UserProfile['remoteFrequency'], string> = { remote: 'Fully Remote', hybrid: 'Hybrid', office: 'In-Office' }

export function buildProfileLabel(profile: UserProfile): string {
  const parts: string[] = [
    MODE_LABELS[profile.mode],
    REMOTE_LABELS[profile.remoteFrequency],
  ]
  if (profile.workLat != null && profile.workLat !== 0) parts.push('Work')
  parts.push(profile.hasKids ? 'Kids' : 'No Kids')
  parts.push(profile.hasPet ? 'Pet' : 'No Pet')
  return parts.join(', ')
}

function buildSystemPrompt(): string {
  return [
    'You are a real-estate analyst for a Chrome extension called CivicEstate.',
    'Reason step by step before producing output.',
    'Only reference zestimate, annualTax, or propertyTaxRate if they are not null in the data.',
    'Do not reference sex offender data under any circumstance.',
    'Output strict JSON only — no markdown fences, no preamble, no explanation outside the JSON object.',
    '',
    'NARRATIVE RULES:',
    '- Exactly 3 sentences.',
    '- Each sentence must cite at least one real number from the data (commute minutes, distance miles, price, crime index, slope %, etc.).',
    '- Write for THIS specific buyer: reference their commute mode (drives/transit/walk), whether they have kids, and whether they have pets by name.',
    '- Do not be generic — tie every sentence to a tension or advantage unique to this profile.',
    '',
    'HIGHLIGHTS RULES:',
    '- Minimum 4, maximum 7 items.',
    '- Each item must start with exactly one of: ✅ ❌ ⚠️ 💰',
    '- ✅ for positives, ❌ for hard negatives, ⚠️ for warnings, 💰 for financial observations.',
    '- Each item must cite at least one real number from the data.',
    '',
    'AGENT QUESTIONS RULES:',
    '- Exactly 1 question.',
    '- It must reference a specific number or flag from the data (e.g. a crime index value, a slope percentage, a flood zone designation).',
    '- The question must be actionable — something a real estate agent can actually answer or investigate.',
  ].join('\n')
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
    '- agentQuestions: a JSON array containing exactly 1 string — e.g. ["What about...?"]. Must be an array, not a bare string.',
    '- chatContext: one dense paragraph summarizing all fetched facts for later chat use',
  ].join('\n')
}

function validateOutput(obj: unknown): GeminiOutput | null {
  if (typeof obj !== 'object' || obj === null) {
    console.error('[CivicEstate gemini][validate] obj is not an object:', obj)
    return null
  }
  const o = obj as Record<string, unknown>

  // scores
  const scores = o.scores as Record<string, unknown> | undefined
  if (!scores || typeof scores !== 'object') {
    console.error('[CivicEstate gemini][validate] scores missing or not object:', scores)
    return null
  }
  for (const k of ['lifestyle', 'accessibility', 'family', 'riskCost', 'overall']) {
    if (typeof scores[k] !== 'number') {
      console.error(`[CivicEstate gemini][validate] scores.${k} is not a number:`, scores[k])
      return null
    }
  }

  // scoreDeltas
  const deltas = o.scoreDeltas as Record<string, unknown> | undefined
  if (!deltas || typeof deltas !== 'object') {
    console.error('[CivicEstate gemini][validate] scoreDeltas missing or not object:', deltas)
    return null
  }
  for (const k of ['lifestyle', 'accessibility', 'family', 'riskCost', 'overall']) {
    if (typeof deltas[k] !== 'number') {
      console.error(`[CivicEstate gemini][validate] scoreDeltas.${k} is not a number:`, deltas[k])
      return null
    }
  }

  // narrative — must be a non-empty string longer than 50 chars
  if (typeof o.narrative !== 'string' || o.narrative.length <= 50) {
    console.error('[CivicEstate gemini][validate] narrative missing or too short:', o.narrative)
    return null
  }

  // highlights — 4-7 items, each string starting with ✅ ❌ ⚠️ ⚠ or 💰
  if (!Array.isArray(o.highlights)) {
    console.error('[CivicEstate gemini][validate] highlights is not an array:', o.highlights)
    return null
  }
  if (o.highlights.length < 4 || o.highlights.length > 7) {
    console.error(`[CivicEstate gemini][validate] highlights length ${o.highlights.length} out of range 4-7:`, o.highlights)
    return null
  }
  const VALID_PREFIXES = /^(✅|❌|⚠️?|💰)/u
  for (const h of o.highlights) {
    if (typeof h !== 'string' || !VALID_PREFIXES.test(h)) {
      console.error('[CivicEstate gemini][validate] highlight item failed prefix check:', h)
      return null
    }
  }

  // agentQuestions — exactly 1; coerce bare string → array
  if (typeof o.agentQuestions === 'string') {
    o.agentQuestions = [o.agentQuestions]
  }
  if (!Array.isArray(o.agentQuestions) || o.agentQuestions.length !== 1) {
    console.error(`[CivicEstate gemini][validate] agentQuestions length ${(o.agentQuestions as unknown[])?.length} (expected 1):`, o.agentQuestions)
    return null
  }
  if (!o.agentQuestions.every((q: unknown) => typeof q === 'string')) {
    console.error('[CivicEstate gemini][validate] agentQuestions contains non-string:', o.agentQuestions)
    return null
  }

  // chatContext
  if (typeof o.chatContext !== 'string' || o.chatContext.length === 0) {
    console.error('[CivicEstate gemini][validate] chatContext missing or empty:', o.chatContext)
    return null
  }

  return obj as GeminiOutput
}

async function callGemini(data: Phase2Result, profile: UserProfile): Promise<unknown> {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(data, profile)
  console.log('[CivicEstate gemini][callGemini] system prompt:\n', systemPrompt)
  console.log('[CivicEstate gemini][callGemini] user prompt:\n', userPrompt)

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userPrompt }] }],
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

  console.log(`[CivicEstate gemini][callGemini] response status: ${res.status}, ok: ${res.ok}`)

  if (!res.ok) {
    console.error(`[CivicEstate gemini] HTTP ${res.status}:`, await res.text())
    return null
  }

  const json = await res.json()
  console.log('[CivicEstate gemini][callGemini] raw response body:', json)

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    console.error('[CivicEstate gemini] No text in response:', json)
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (parseErr) {
    console.error('[CivicEstate gemini][callGemini] JSON.parse failed:', parseErr, '\nraw text:', text)
    return null
  }
  console.log('[CivicEstate gemini][callGemini] parsed object:', parsed)
  return parsed
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
    console.error('[CivicEstate gemini] runGeminiAnalysis failed — full error:', err)
    return null
  }
}
