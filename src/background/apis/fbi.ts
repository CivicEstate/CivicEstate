import { FBI_API_KEY } from '../../constants/apiKeys'

interface CrimeResult {
  crimeGrade: string | null
  crimeIndex: number | null
}

const CDE_BASE = 'https://api.usa.gov/crime/fbi/cde'

export async function fetchCrimeData(rawAddress: string): Promise<CrimeResult> {
  try {
    const { city, state } = parseAddress(rawAddress)
    if (!city || !state) {
      console.warn('[CivicEstate fbi] Could not parse city/state from:', rawAddress)
      return { crimeGrade: null, crimeIndex: null }
    }

    const ori = await findORI(state, city)
    if (!ori) {
      console.warn('[CivicEstate fbi] No ORI found for', city, state)
      return { crimeGrade: null, crimeIndex: null }
    }

    const crimeIndex = await getOffenseData(ori)
    if (crimeIndex === null) {
      return { crimeGrade: null, crimeIndex: null }
    }

    const crimeGrade = indexToGrade(crimeIndex)
    const result: CrimeResult = { crimeGrade, crimeIndex }
    console.log('[CivicEstate fbi] result:', result)
    return result
  } catch (err) {
    console.error('[CivicEstate fbi] fetch failed:', err)
    return { crimeGrade: null, crimeIndex: null }
  }
}

function parseAddress(raw: string): { city: string | null; state: string | null } {
  // Zillow format: "123 Main St, City, ST 12345"
  const parts = raw.split(',').map((s) => s.trim())
  if (parts.length < 3) return { city: null, state: null }

  const city = parts[1]
  const stateZip = parts[2]
  const stateMatch = stateZip.match(/^([A-Z]{2})\s/)
  const state = stateMatch ? stateMatch[1] : null

  return { city, state }
}

async function findORI(state: string, city: string): Promise<string | null> {
  try {
    const url = `${CDE_BASE}/agency/byStateAbbr/${state}?API_KEY=${FBI_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[CivicEstate fbi] agency lookup HTTP', res.status)
      return null
    }

    const raw = await res.json()
    const agencies: any[] = Array.isArray(raw) ? raw : (raw?.results ?? raw?.data ?? Object.values(raw))
    const cityLower = city.toLowerCase()

    const match =
      agencies.find((a) => a.agency_name?.toLowerCase().includes(cityLower)) ??
      agencies.find((a) => a.agency_name?.toLowerCase().includes(cityLower.split(' ')[0]))

    return match?.ori ?? null
  } catch (err) {
    console.error('[CivicEstate fbi] ORI lookup failed:', err)
    return null
  }
}

async function getOffenseData(ori: string): Promise<number | null> {
  try {
    const url = `${CDE_BASE}/summarized/agency/${ori}/offenses/2020/2022?API_KEY=${FBI_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[CivicEstate fbi] offense data HTTP', res.status)
      return null
    }

    const data: any = await res.json()

    let totalOffenses = 0
    let population = 0

    if (Array.isArray(data)) {
      for (const entry of data) {
        totalOffenses += entry.actual ?? 0
        if (entry.population && entry.population > population) {
          population = entry.population
        }
      }
    }

    if (population === 0) {
      console.warn('[CivicEstate fbi] No population data for ORI', ori)
      return null
    }

    const years = 3
    const perThousand = (totalOffenses / years / population) * 1000
    return Math.min(Math.round(perThousand), 100)
  } catch (err) {
    console.error('[CivicEstate fbi] offense data failed:', err)
    return null
  }
}

function indexToGrade(index: number): string {
  if (index <= 15) return 'A'
  if (index <= 30) return 'B'
  if (index <= 50) return 'C'
  if (index <= 70) return 'D'
  return 'F'
}
