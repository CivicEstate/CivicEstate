import { UserProfile, ProfileWeights } from '../../types/index'
import { GEMINI_API_KEY } from '../../constants/apiKeys'

export const DEFAULT_PROFILE_WEIGHTS: ProfileWeights = {
  commuteWeight: 0.8,
  walkabilityWeight: 0.6,
  slopeWeight: 0.5,
  crimeWeight: 0.7,
  floodWeight: 0.6,
  wildfireWeight: 0.6,
  taxWeight: 0.5,
  schoolWeight: 0.5,
  parkWeight: 0.4,
  childcareWeight: 0.4,
  priceDeltaWeight: 0.6,
}

const SYSTEM_PROMPT = `You are a real estate prioritization engine. Given a home buyer's profile, reason about which factors matter most to THIS buyer and return a JSON object of type
 ProfileWeights with values between 0.0 and 1.0.

The ProfileWeights keys are:
commuteWeight, walkabilityWeight, slopeWeight, crimeWeight, floodWeight, wildfireWeight, taxWeight, schoolWeight, parkWeight, childcareWeight, priceDeltaWeight

Rules:
- Return ONLY valid JSON. No markdown, no explanation, no preamble.
- Every key must be present with a number between 0.0 and 1.0.
- Higher values mean the buyer cares more about that factor.

Examples of reasoning (do NOT include in output):
- hasKids=true → schoolWeight and childcareWeight should be high
- mobility=wheelchair → slopeWeight and walkabilityWeight should be very high
- taxSensitive=true → taxWeight should be high
- remoteFrequency=remote → commuteWeight should be low
- hasPet=true → parkWeight should be higher`

export async function geminiWeights(profile: UserProfile): Promise<ProfileWeights> {
  const userPrompt = JSON.stringify(profile)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.0,
          },
        }),
      }
    )

    if (!res.ok) {
      console.error('[CivicEstate geminiWeights] HTTP error:', res.status)
      return DEFAULT_PROFILE_WEIGHTS
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('[CivicEstate geminiWeights] No text in response')
      return DEFAULT_PROFILE_WEIGHTS
    }

    const parsed = JSON.parse(text) as ProfileWeights

    // Validate all keys exist and are numbers 0-1
    const keys: (keyof ProfileWeights)[] = [
      'commuteWeight', 'walkabilityWeight', 'slopeWeight', 'crimeWeight',
      'floodWeight', 'wildfireWeight', 'taxWeight', 'schoolWeight',
      'parkWeight', 'childcareWeight', 'priceDeltaWeight',
    ]
    for (const k of keys) {
      if (typeof parsed[k] !== 'number' || parsed[k] < 0 || parsed[k] > 1) {
        console.error('[CivicEstate geminiWeights] Invalid weight for', k, parsed[k])
        return DEFAULT_PROFILE_WEIGHTS
      }
    }

    console.log('[CivicEstate geminiWeights] Success:', parsed)
    return parsed
  } catch (err) {
    console.error('[CivicEstate geminiWeights] Failed:', err)
    return DEFAULT_PROFILE_WEIGHTS
  }
}
