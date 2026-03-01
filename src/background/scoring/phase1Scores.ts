import { UserProfile, ProfileWeights } from '../../types/index'

interface Phase1ScoreInputs {
  commute: { carPeak: number | null; carOffpeak: number | null; transit: number | null; walk: number | null }
  osmWalkabilityScore: number | null
  crimeGrade: string | null
  crimeIndex: number | null
  floodRisk: string | null
  wildfireHazard: string | null
  annualTax: number | null
  price: number
  priceDelta: number | null
}

interface Phase1Scores {
  lifestyle: number
  accessibility: number
  family: number
  riskCost: number
  overall: number
}

export function computePhase1Scores(
  inputs: Phase1ScoreInputs,
  profile: UserProfile,
  weights: ProfileWeights
): Phase1Scores {
  // --- Sub-scores (all 0-10) ---

  // Commute score: pick the mode the user cares about
  const commuteMinutes = getCommuteForMode(inputs.commute, profile.mode)
  const commuteScore = commuteMinutes !== null ? commuteToScore(commuteMinutes) : 5

  // Walkability: OSM score 0-100 → 0-10
  const walkScore = inputs.osmWalkabilityScore !== null ? Math.min(inputs.osmWalkabilityScore / 10, 10) : 5

  // Crime: index 0-100 → inverted 0-10 (low crime = high score)
  const crimeScore = inputs.crimeIndex !== null ? Math.max(10 - inputs.crimeIndex / 10, 0) : 5

  // Flood risk
  const floodScore = floodRiskToScore(inputs.floodRisk)

  // Wildfire hazard
  const wildfireScore = wildfireToScore(inputs.wildfireHazard)

  // Tax burden: annualTax as % of price
  const taxScore = taxToScore(inputs.annualTax, inputs.price)

  // Price delta: negative = below zestimate = good deal
  const priceDeltaScore = priceDeltaToScore(inputs.priceDelta, inputs.price)

  // --- Category scores (weighted averages) ---
  const lifestyle = weightedAvg([
    [commuteScore, weights.commuteWeight],
    [walkScore, weights.walkabilityWeight],
  ])

  const accessibility = weightedAvg([
    [walkScore, weights.walkabilityWeight],
    [commuteScore, weights.commuteWeight * 0.5],
  ])

  const family = weightedAvg([
    [crimeScore, weights.crimeWeight],
    [walkScore, weights.walkabilityWeight * 0.5],
  ])

  const riskCost = weightedAvg([
    [floodScore, weights.floodWeight],
    [wildfireScore, weights.wildfireWeight],
    [taxScore, weights.taxWeight],
    [priceDeltaScore, weights.priceDeltaWeight],
    [crimeScore, weights.crimeWeight],
  ])

  // Overall: fixed category weights
  const overall = round1(
    lifestyle * 0.30 + accessibility * 0.15 + family * 0.25 + riskCost * 0.30
  )

  const scores: Phase1Scores = {
    lifestyle: round1(lifestyle),
    accessibility: round1(accessibility),
    family: round1(family),
    riskCost: round1(riskCost),
    overall,
  }

  console.log('[CivicEstate phase1Scores] sub-scores:', {
    commuteScore,
    walkScore,
    crimeScore,
    floodScore,
    wildfireScore,
    taxScore,
    priceDeltaScore,
  })
  console.log('[CivicEstate phase1Scores] final:', scores)
  return scores
}

function getCommuteForMode(
  commute: Phase1ScoreInputs['commute'],
  mode: UserProfile['mode']
): number | null {
  if (mode === 'drives') return commute.carPeak
  if (mode === 'transit') return commute.transit
  if (mode === 'walk') return commute.walk
  return commute.carPeak
}

function commuteToScore(minutes: number): number {
  // 0 min = 10, 60+ min = 0, linear
  return Math.max(0, Math.min(10, 10 - (minutes / 60) * 10))
}

function floodRiskToScore(risk: string | null): number {
  if (!risk) return 5
  if (risk === 'Low') return 9
  if (risk === 'Moderate') return 6
  if (risk === 'High') return 2
  if (risk === 'Undetermined') return 5
  return 5
}

function wildfireToScore(hazard: string | null): number {
  if (!hazard) return 5
  const lower = hazard.toLowerCase()
  if (lower.includes('very high')) return 2
  if (lower.includes('high')) return 4
  if (lower.includes('moderate')) return 7
  return 5
}

function taxToScore(annualTax: number | null, price: number): number {
  if (!annualTax || price === 0) return 5
  const rate = (annualTax / price) * 100
  // <0.8% = 9, 0.8-1.2% = 7, 1.2-1.5% = 5, 1.5-2% = 3, >2% = 1
  if (rate < 0.8) return 9
  if (rate < 1.2) return 7
  if (rate < 1.5) return 5
  if (rate < 2.0) return 3
  return 1
}

function priceDeltaToScore(delta: number | null, price: number): number {
  if (delta === null || price === 0) return 5
  const pct = (delta / price) * 100
  // -10% or more below = 9, at zestimate = 5, +10% above = 1
  return Math.max(0, Math.min(10, 5 - pct * 0.4))
}

function weightedAvg(pairs: [number, number][]): number {
  let sum = 0
  let totalWeight = 0
  for (const [value, weight] of pairs) {
    sum += value * weight
    totalWeight += weight
  }
  return totalWeight > 0 ? sum / totalWeight : 5
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
