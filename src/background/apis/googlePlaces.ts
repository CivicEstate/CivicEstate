// TODO: implement Google Places Nearby Search
export interface NearbyPlacesResult {
  grocery: number | null
  pharmacy: number | null
  park: number | null
  hospital: number | null
  childcare: number | null
  school: number | null
}

export async function fetchNearbyPlaces(
  _lat: number,
  _lon: number
): Promise<NearbyPlacesResult> {
  throw new Error('fetchNearbyPlaces not yet implemented')
}
