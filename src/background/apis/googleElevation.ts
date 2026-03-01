// TODO: implement Google Elevation API
export interface ElevationResult {
  avgSlope: number | null
  maxSlope: number | null
  adaFlag: boolean
}

export async function fetchElevationData(
  _lat: number,
  _lon: number
): Promise<ElevationResult> {
  throw new Error('fetchElevationData not yet implemented')
}
