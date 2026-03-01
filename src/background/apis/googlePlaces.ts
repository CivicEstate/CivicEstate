import { GOOGLE_PLACES_KEY } from '../../constants/apiKeys'

export interface NearbyPlacesResult {
  grocery: number | null
  pharmacy: number | null
  park: number | null
  hospital: number | null
  childcare: number | null
  school: number | null
}

const CATEGORY_TYPES: Record<keyof NearbyPlacesResult, string> = {
  grocery: 'grocery_or_supermarket',
  pharmacy: 'pharmacy',
  park: 'park',
  hospital: 'hospital',
  childcare: 'child_care',
  school: 'school',
}

function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchCategory(
  lat: number,
  lon: number,
  type: string
): Promise<number | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=2000&type=${type}&key=${GOOGLE_PLACES_KEY}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[CivicEstate googlePlaces] HTTP ${res.status} for ${type}`)
      return null
    }

    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.[0]) {
      console.warn(`[CivicEstate googlePlaces] No results for ${type}:`, data.status)
      return null
    }

    const placeLat = data.results[0].geometry?.location?.lat
    const placeLon = data.results[0].geometry?.location?.lng
    if (typeof placeLat !== 'number' || typeof placeLon !== 'number') return null

    const dist = haversineDistanceMiles(lat, lon, placeLat, placeLon)
    return Math.round(dist * 100) / 100
  } catch (err) {
    console.error(`[CivicEstate googlePlaces] ${type} fetch failed:`, err)
    return null
  }
}

export async function fetchNearbyPlaces(
  lat: number,
  lon: number
): Promise<NearbyPlacesResult> {
  const keys = Object.keys(CATEGORY_TYPES) as (keyof NearbyPlacesResult)[]
  const distances = await Promise.all(
    keys.map((k) => fetchCategory(lat, lon, CATEGORY_TYPES[k]))
  )

  const result = {} as NearbyPlacesResult
  keys.forEach((k, i) => {
    result[k] = distances[i]
  })

  console.log('[CivicEstate googlePlaces] nearby result:', result)
  return result
}
