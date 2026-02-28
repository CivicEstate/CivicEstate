export interface UserProfile {
  mode: 'drives' | 'transit' | 'walk'
  workLat: number
  workLon: number
  remoteFrequency: 'remote' | 'hybrid' | 'office'
  hasKids: boolean
  hasPet: boolean
  mobility: 'none' | 'wheelchair' | 'elderly'
  ageRange: '20s30s' | '40s50s' | '60s'
  taxSensitive: boolean
}

export interface ExtractedListing {
  // Always present
  zpid: string
  rawAddress: string
  lat: number
  lon: number
  price: number
  beds: number
  baths: number
  // Almost always present
  sqft: number | null
  yearBuilt: number | null
  homeType: string | null
  listingDescription: string | null
  // Financial
  zestimate: number | null
  priceDelta: number | null
  annualTax: number | null
  propertyTaxRate: number | null
  annualHomeownersInsurance: number | null
  priceDeltaFlag: boolean
}

export interface Phase1Result extends ExtractedListing {
  lat: number
  lon: number
  annualTax: number
  yearBuilt: number
  priceDelta: number
  priceDeltaFlag: boolean
  commute: {
    carPeak: number | null
    carOffpeak: number | null
    transit: number | null
    walk: number | null
  }
  floodZone: string | null
  floodRisk: string | null
  wildfireHazard: string | null
  crimeGrade: string | null
  crimeIndex: number | null
  osmWalkabilityScore: number | null
  scores: {
    lifestyle: number
    accessibility: number
    family: number
    riskCost: number
    overall: number
  }
}

export interface GeminiOutput {
  scores: {
    lifestyle: number
    accessibility: number
    family: number
    riskCost: number
    overall: number
  }
  scoreDeltas: {
    lifestyle: number
    accessibility: number
    family: number
    riskCost: number
    overall: number
  }
  narrative: string
  highlights: string[]
  agentQuestions: string[]
  chatContext: string
}

export interface Phase2Result extends Phase1Result {
  grocery: number | null
  pharmacy: number | null
  park: number | null
  hospital: number | null
  childcare: number | null
  school: number | null
  avgSlope: number | null
  maxSlope: number | null
  adaFlag: boolean
  listingMentionsStairs: boolean
  listingMentionsElevator: boolean
  schools: {
    name: string
    type: string
    rating: number
    distance: number
  }[]
  geminiOutput: GeminiOutput | null
}

export enum CardState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PHASE1_COMPLETE = 'PHASE1_COMPLETE',
  PHASE2_LOADING = 'PHASE2_LOADING',
  PHASE2_COMPLETE = 'PHASE2_COMPLETE',
  ERROR = 'ERROR',
}
