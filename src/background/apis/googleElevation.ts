import { GOOGLE_ELEVATION_KEY } from '../../constants/apiKeys'

export interface ElevationResult {
  avgSlope: number | null
  maxSlope: number | null
  adaFlag: boolean
}

const SAMPLES = 10
const PATH_METERS = 500

function movePointNorth(lat: number, meters: number): number {
  return lat + meters / 111320
}

export async function fetchElevationData(
  lat: number,
  lon: number
): Promise<ElevationResult> {
  try {
    const endLat = movePointNorth(lat, PATH_METERS)
    const url = `https://maps.googleapis.com/maps/api/elevation/json?path=${lat},${lon}|${endLat},${lon}&samples=${SAMPLES}&key=${GOOGLE_ELEVATION_KEY}`

    const res = await fetch(url)
    if (!res.ok) {
      console.error(`[CivicEstate googleElevation] HTTP ${res.status}`)
      return { avgSlope: null, maxSlope: null, adaFlag: false }
    }

    const data = await res.json()
    if (data.status !== 'OK' || !data.results || data.results.length < 2) {
      console.warn('[CivicEstate googleElevation] Bad response:', data.status)
      return { avgSlope: null, maxSlope: null, adaFlag: false }
    }

    const points: number[] = data.results.map((r: { elevation: number }) => r.elevation)
    const horizontalDist = PATH_METERS / (SAMPLES - 1)
    const slopes: number[] = []

    for (let i = 1; i < points.length; i++) {
      const elevDiff = Math.abs(points[i] - points[i - 1])
      slopes.push((elevDiff / horizontalDist) * 100)
    }

    const avgSlope = Math.round((slopes.reduce((a, b) => a + b, 0) / slopes.length) * 100) / 100
    const maxSlope = Math.round(Math.max(...slopes) * 100) / 100
    const adaFlag = avgSlope > 5

    const result: ElevationResult = { avgSlope, maxSlope, adaFlag }
    console.log('[CivicEstate googleElevation] elevation result:', result)
    return result
  } catch (err) {
    console.error('[CivicEstate googleElevation] fetch failed:', err)
    return { avgSlope: null, maxSlope: null, adaFlag: false }
  }
}
