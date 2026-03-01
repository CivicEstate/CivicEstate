import { detectPageType, findNextData, extractListings } from '../utils/domParser'

const url = window.location.href
const pageType = detectPageType(url)
console.log(`[CivicEstate] Page type: ${pageType} — URL: ${url}`)

if (pageType === 'other') {
  console.log('[CivicEstate] Not a search or detail page, skipping.')
} else if (pageType === 'search') {
  const nextData = findNextData()

  if (!nextData) {
    console.log('[CivicEstate] No __NEXT_DATA__ found on this page.')
  } else {
    const listings = extractListings(nextData)
    console.log(`[CivicEstate] Extracted ${listings.length} listings:`, listings)

    if (listings.length === 0) {
      console.warn('[CivicEstate] Zero listings extracted — check __NEXT_DATA__ structure.')
    } else {
      chrome.runtime.sendMessage(
        { type: 'LISTINGS_EXTRACTED', payload: listings },
        (response) => {
          console.log('[CivicEstate] Background responded to LISTINGS_EXTRACTED:', response)
        }
      )
    }
  }
} else {
  // detail page — Phase 2 pipeline will handle this later
  console.log('[CivicEstate] Detail page detected, no extraction needed.')
}
