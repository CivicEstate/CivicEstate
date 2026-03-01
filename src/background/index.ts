import { UserProfile, ExtractedListing } from '../types/index'
import { GOOGLE_MAPS_KEY } from '../constants/apiKeys'
import { geminiWeights, DEFAULT_PROFILE_WEIGHTS } from './apis/geminiWeights'
import { runPhase1Pipeline, MOCK_LISTING } from './phase1Pipeline'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CivicEstate background] received:', message, 'from:', sender)

  if (message.type === 'GEOCODE_WORK_LOCATION') {
    const address = message.payload as string
    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
    )
      .then((r) => r.json())
      .then((data) => {
        console.log('[CivicEstate geocode] Google response:', data)
        if (data.status === 'OK' && data.results[0]) {
          const { lat, lng } = data.results[0].geometry.location
          sendResponse({ lat, lon: lng })
        } else {
          sendResponse({ error: true })
        }
      })
      .catch((err) => {
        console.error('[CivicEstate geocode] fetch failed:', err)
        sendResponse({ error: true })
      })
    return true
  }

  if (message.type === 'SAVE_PROFILE') {
    const profile = message.payload as UserProfile
    geminiWeights(profile)
      .then((weights) => {
        console.log('[CivicEstate background] Gemini weights:', weights)
        chrome.storage.local.set({ profileWeights: weights })
        sendResponse({ status: 'weights-saved', weights })
      })
      .catch((err) => {
        console.error('[CivicEstate background] geminiWeights failed, using defaults:', err)
        chrome.storage.local.set({ profileWeights: DEFAULT_PROFILE_WEIGHTS })
        sendResponse({ status: 'weights-saved', weights: DEFAULT_PROFILE_WEIGHTS })
      })
    return true
  }

  if (message.type === 'LISTINGS_EXTRACTED') {
    const listings = message.payload as ExtractedListing[]
    console.log('[CivicEstate background] Received', listings.length, 'listings from DOM parser')
    chrome.storage.local.get('userProfile', (result) => {
      const profile = result.userProfile as UserProfile | undefined
      if (!profile) {
        console.warn('[CivicEstate background] No user profile found, cannot run Phase 1')
        sendResponse({ status: 'error', reason: 'no-profile' })
        return
      }
      runPhase1Pipeline(listings, profile)
        .then(() => sendResponse({ status: 'phase1-started' }))
        .catch((err) => {
          console.error('[CivicEstate background] Phase 1 failed:', err)
          sendResponse({ status: 'error', reason: String(err) })
        })
    })
    return true
  }

  if (message.type === 'TRIGGER_ANALYSIS') {
    console.log('[CivicEstate background] TRIGGER_ANALYSIS — using mock listing')
    chrome.storage.local.get('userProfile', (result) => {
      const profile = result.userProfile as UserProfile | undefined
      if (!profile) {
        console.warn('[CivicEstate background] No user profile found, cannot run Phase 1')
        sendResponse({ status: 'error', reason: 'no-profile' })
        return
      }
      runPhase1Pipeline([MOCK_LISTING], profile)
        .then(() => sendResponse({ status: 'phase1-started' }))
        .catch((err) => {
          console.error('[CivicEstate background] Phase 1 failed:', err)
          sendResponse({ status: 'error', reason: String(err) })
        })
    })
    return true
  }

  sendResponse({ status: 'background-received' })
  return true
})
