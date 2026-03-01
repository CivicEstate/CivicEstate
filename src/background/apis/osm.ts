interface WalkabilityResult {
  osmWalkabilityScore: number | null
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export async function fetchWalkability(lat: number, lon: number): Promise<WalkabilityResult> {
  try {
    const radius = 2000
    const query = `
[out:json][timeout:15];
(
  node["shop"="supermarket"](around:${radius},${lat},${lon});
  node["amenity"="pharmacy"](around:${radius},${lat},${lon});
  node["amenity"="restaurant"](around:${radius},${lat},${lon});
  node["leisure"="park"](around:${radius},${lat},${lon});
  way["leisure"="park"](around:${radius},${lat},${lon});
  node["highway"="bus_stop"](around:${radius},${lat},${lon});
  node["railway"="station"](around:${radius},${lat},${lon});
  node["railway"="tram_stop"](around:${radius},${lat},${lon});
);
out body;
`.trim()

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    })

    if (!res.ok) {
      console.error('[CivicEstate osm] HTTP', res.status)
      return { osmWalkabilityScore: null }
    }

    const data = await res.json()
    const elements: any[] = data.elements ?? []

    let grocery = 0
    let pharmacy = 0
    let restaurant = 0
    let park = 0
    let transit = 0

    for (const el of elements) {
      const tags = el.tags ?? {}
      if (tags.shop === 'supermarket') grocery++
      else if (tags.amenity === 'pharmacy') pharmacy++
      else if (tags.amenity === 'restaurant') restaurant++
      else if (tags.leisure === 'park') park++
      else if (
        tags.highway === 'bus_stop' ||
        tags.railway === 'station' ||
        tags.railway === 'tram_stop'
      )
        transit++
    }

    // Weighted: grocery×8, pharmacy×6, restaurant×2, park×5, transit×4
    const raw = grocery * 8 + pharmacy * 6 + restaurant * 2 + park * 5 + transit * 4
    const score = Math.min(raw, 100)

    console.log(
      '[CivicEstate osm] counts:',
      { grocery, pharmacy, restaurant, park, transit },
      'score:',
      score
    )
    return { osmWalkabilityScore: score }
  } catch (err) {
    console.error('[CivicEstate osm] fetch failed:', err)
    return { osmWalkabilityScore: null }
  }
}
