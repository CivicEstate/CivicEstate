/**
 * domParser.ts — Zillow DOM parsing utilities
 * Extracts listing data from Zillow pages.
 */

import type { ExtractedListing } from '../types/index'

export type ZillowPageType = 'search' | 'detail' | 'other'

const MAX_LISTINGS = 10

export function detectPageType(url: string): ZillowPageType {
  const path = new URL(url).pathname

  if (path.includes('/homedetails/')) return 'detail'

  if (
    path.includes('/homes/') ||
    path.includes('/homes') ||
    path === '/' ||
    /\/[a-z]+-[a-z]{2}\/?$/i.test(path)
  ) {
    return 'search'
  }

  return 'other'
}

export function findNextData(): Record<string, unknown> | null {
  const scriptTag = document.querySelector('script#__NEXT_DATA__')
  if (!scriptTag?.textContent) {
    console.warn('[CivicEstate] __NEXT_DATA__ script tag not found')
    return null
  }

  try {
    const parsed = JSON.parse(scriptTag.textContent)
    return parsed as Record<string, unknown>
  } catch (e) {
    console.error('[CivicEstate] Failed to parse __NEXT_DATA__:', e)
    return null
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function extractListings(nextData: Record<string, unknown>): ExtractedListing[] {
  const listResults = (nextData as any)?.props?.pageProps?.searchPageState?.cat1?.searchResults
    ?.listResults as any[] | undefined

  if (!listResults || !Array.isArray(listResults)) {
    console.warn('[CivicEstate] No listResults found at expected path')
    return []
  }

  const extracted: ExtractedListing[] = []

  for (const listing of listResults) {
    if (extracted.length >= MAX_LISTINGS) break

    // Required fields — skip listing if any are missing
    const zpid = listing.zpid
    const rawAddress = listing.address
    const lat = listing.latLong?.latitude
    const lon = listing.latLong?.longitude
    const price = listing.unformattedPrice
    const beds = listing.beds
    const baths = listing.baths

    if (
      zpid == null ||
      rawAddress == null ||
      lat == null ||
      lon == null ||
      price == null ||
      beds == null ||
      baths == null
    ) {
      continue
    }

    const sqft: number | null = listing.area ?? null
    const zestimate: number | null = listing.zestimate ?? null

    let priceDelta: number | null = null
    let priceDeltaFlag = false
    if (zestimate != null) {
      priceDelta = price - zestimate
      priceDeltaFlag = Math.abs(priceDelta) > zestimate * 0.05
    }

    extracted.push({
      zpid: String(zpid),
      rawAddress,
      lat,
      lon,
      price,
      beds,
      baths,
      sqft,
      zestimate,
      yearBuilt: null,
      annualTax: null,
      propertyTaxRate: null,
      annualHomeownersInsurance: null,
      listingDescription: null,
      homeType: null,
      priceDelta,
      priceDeltaFlag,
    })
  }

  return extracted
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface ListingTextFlags {
  listingMentionsStairs: boolean
  listingMentionsElevator: boolean
}

const STAIRS_PATTERN = /\b(stairs|staircase|stairway|steps|multi[- ]?level|split[- ]?level|tri[- ]?level)\b/i
const ELEVATOR_PATTERN = /\b(elevator|lift|ada[- ]?accessible)\b/i

export function parseListingDescription(description: string | null): ListingTextFlags {
  if (!description) return { listingMentionsStairs: false, listingMentionsElevator: false }
  return {
    listingMentionsStairs: STAIRS_PATTERN.test(description),
    listingMentionsElevator: ELEVATOR_PATTERN.test(description),
  }
}
