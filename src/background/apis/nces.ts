export interface SchoolEntry {
  name: string
  type: string
  rating: number
  distance: number
}

interface SchoolRecord {
  name: string
  type: 'elementary' | 'middle' | 'high'
  rating: number
  lat: number
  lon: number
}

const IRVINE_SCHOOLS: SchoolRecord[] = [
  { name: 'Stonegate Elementary', type: 'elementary', rating: 9, lat: 33.7192, lon: -117.7376 },
  { name: 'Northwood Elementary', type: 'elementary', rating: 8, lat: 33.7341, lon: -117.7471 },
  { name: 'Meadow Park Elementary', type: 'elementary', rating: 7, lat: 33.6693, lon: -117.7638 },
  { name: 'Eastshore Elementary', type: 'elementary', rating: 8, lat: 33.6721, lon: -117.7421 },
  { name: 'Canyon View Elementary', type: 'elementary', rating: 8, lat: 33.6781, lon: -117.7318 },
  { name: 'Lakeside Middle School', type: 'middle', rating: 8, lat: 33.6897, lon: -117.7781 },
  { name: 'Northwood High School', type: 'high', rating: 9, lat: 33.7389, lon: -117.7498 },
  { name: 'Irvine High School', type: 'high', rating: 8, lat: 33.6694, lon: -117.7781 },
]

const YUCAIPA_SCHOOLS: SchoolRecord[] = [
  { name: 'Calimesa Elementary', type: 'elementary', rating: 7, lat: 34.0116, lon: -117.0631 },
  { name: 'Chapman Heights Elementary', type: 'elementary', rating: 8, lat: 34.0338, lon: -117.0208 },
  { name: 'Dunlap Elementary', type: 'elementary', rating: 7, lat: 34.0333, lon: -117.0431 },
  { name: 'Hillside Elementary', type: 'elementary', rating: 7, lat: 34.0422, lon: -117.0557 },
  { name: 'Park View Elementary', type: 'elementary', rating: 6, lat: 34.0297, lon: -117.0499 },
  { name: 'Yucaipa Middle School', type: 'middle', rating: 7, lat: 34.0337, lon: -117.0433 },
  { name: 'Mesa View Middle School', type: 'middle', rating: 7, lat: 34.0218, lon: -117.0338 },
  { name: 'Yucaipa High School', type: 'high', rating: 7, lat: 34.0372, lon: -117.0299 },
]

function selectDataset(lat: number, lon: number): SchoolRecord[] {
  if (lat >= 33.60 && lat <= 33.80 && lon >= -117.90 && lon <= -117.65) {
    return IRVINE_SCHOOLS
  }
  return YUCAIPA_SCHOOLS
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

export async function fetchNearbySchools(
  lat: number,
  lon: number
): Promise<SchoolEntry[] | null> {
  try {
    const dataset = selectDataset(lat, lon)
    const withDistance = dataset.map((s) => ({
      name: s.name,
      type: s.type,
      rating: s.rating,
      distance: Math.round(haversineDistanceMiles(lat, lon, s.lat, s.lon) * 100) / 100,
    }))

    withDistance.sort((a, b) => a.distance - b.distance)

    const result = withDistance.slice(0, 3)
    console.log('[CivicEstate nces] nearby schools:', result)
    return result
  } catch (err) {
    console.error('[CivicEstate nces] fetchNearbySchools failed:', err)
    return null
  }
}
