import { GOOGLE_MAPS_KEY } from '../../constants/apiKeys'

interface CommuteResult {
  carPeak: number | null
  carOffpeak: number | null
  transit: number | null
  walk: number | null
}

export async function fetchCommute(
  listingLat: number,
  listingLon: number,
  workLat: number,
  workLon: number
): Promise<CommuteResult> {
  const origin = `${listingLat},${listingLon}`
  const dest = `${workLat},${workLon}`

  const [carPeak, carOffpeak, transit, walk] = await Promise.all([
    fetchMode('driving', origin, dest, true),
    fetchMode('driving', origin, dest, false),
    fetchMode('transit', origin, dest, false),
    fetchMode('walking', origin, dest, false),
  ])

  const result: CommuteResult = { carPeak, carOffpeak, transit, walk }
  console.log('[CivicEstate googleMaps] commute result:', result)
  return result
}

async function fetchMode(
  mode: string,
  origin: string,
  destination: string,
  withTraffic: boolean
): Promise<number | null> {
  try {
    const base = 'https://maps.googleapis.com/maps/api/directions/json'
    let url = `${base}?origin=${origin}&destination=${destination}&mode=${mode}&key=${GOOGLE_MAPS_KEY}`

    if (withTraffic) {
      url += '&departure_time=now'
    }

    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[CivicEstate googleMaps] HTTP ${res.status} for ${mode}`)
      return null
    }

    const data = await res.json()
    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      console.warn(`[CivicEstate googleMaps] No route for ${mode}:`, data.status)
      return null
    }

    const leg = data.routes[0].legs[0]
    const seconds = withTraffic
      ? leg.duration_in_traffic?.value ?? leg.duration?.value
      : leg.duration?.value

    if (typeof seconds !== 'number') return null
    return Math.round(seconds / 60)
  } catch (err) {
    console.error(`[CivicEstate googleMaps] ${mode} fetch failed:`, err)
    return null
  }
}
