interface FloodResult {
  floodZone: string | null
  floodRisk: string | null
}

export async function fetchFloodZone(lat: number, lon: number): Promise<FloodResult> {
  try {
    const url =
      'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?' +
      new URLSearchParams({
        geometry: `${lon},${lat}`,
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'FLD_ZONE',
        returnGeometry: 'false',
        f: 'json',
      }).toString()

    console.log('[CivicEstate fema] REQUEST URL:', url)
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[CivicEstate fema] HTTP', res.status)
      return { floodZone: null, floodRisk: null }
    }

    const data = await res.json()
    const zone: string | undefined = data.features?.[0]?.attributes?.FLD_ZONE

    if (!zone) {
      console.warn('[CivicEstate fema] No flood zone feature returned')
      return { floodZone: null, floodRisk: null }
    }

    const result: FloodResult = { floodZone: zone, floodRisk: mapZoneToRisk(zone) }
    console.log('[CivicEstate fema] result:', result)
    return result
  } catch (err) {
    console.error('[CivicEstate fema] fetch failed:', err)
    return { floodZone: null, floodRisk: null }
  }
}

function mapZoneToRisk(zone: string): string {
  const upper = zone.toUpperCase().trim()
  if (['A', 'AE', 'AH', 'AO', 'AR', 'V', 'VE'].includes(upper)) return 'High'
  if (upper === 'X' || upper === 'X (UNSHADED)') return 'Low'
  if (upper === 'X (SHADED)' || upper === 'B') return 'Moderate'
  if (upper === 'D') return 'Undetermined'
  return 'Unknown'
}
