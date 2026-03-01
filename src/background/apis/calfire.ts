interface WildfireResult {
  wildfireHazard: string | null
}

const FHSZ_URL =
  'https://egis.fire.ca.gov/arcgis/rest/services/FRAP/HHZ_ref_FHSZ/MapServer/0/query'

export async function fetchWildfireHazard(lat: number, lon: number): Promise<WildfireResult> {
  try {
    const url =
      FHSZ_URL +
      '?' +
      new URLSearchParams({
        geometry: `${lon},${lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'FHSZ9',
        returnGeometry: 'false',
        f: 'json',
      }).toString()

    const res = await fetch(url)
    if (!res.ok) {
      console.error('[CivicEstate calfire] HTTP', res.status)
      return { wildfireHazard: null }
    }

    const data = await res.json()
    const raw: string | undefined = data.features?.[0]?.attributes?.FHSZ9

    if (!raw) {
      console.log('[CivicEstate calfire] No hazard zone — area not classified')
      return { wildfireHazard: null }
    }

    // FHSZ9 values: "SRA_VeryHigh", "SRA_High", "SRA_Moderate", "LRA_VeryHigh", etc.
    const hazard = parseHazardClass(raw)
    console.log('[CivicEstate calfire] result:', raw, '→', hazard)
    return { wildfireHazard: hazard }
  } catch (err) {
    console.error('[CivicEstate calfire] fetch failed:', err)
    return { wildfireHazard: null }
  }
}

function parseHazardClass(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('veryhigh')) return 'Very High'
  if (lower.includes('high')) return 'High'
  if (lower.includes('moderate')) return 'Moderate'
  return raw
}
