// TODO: implement NCES school search
export interface SchoolEntry {
  name: string
  type: string
  rating: number
  distance: number
}

export async function fetchNearbySchools(
  _lat: number,
  _lon: number
): Promise<SchoolEntry[]> {
  throw new Error('fetchNearbySchools not yet implemented')
}
