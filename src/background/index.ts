import { UserProfile, ProfileWeights } from '../types/index'
import { GOOGLE_MAPS_KEY } from '../constants/apiKeys'

const DEFAULT_WEIGHTS: ProfileWeights = {
  commuteWeight: 0.8,
  walkabilityWeight: 0.6,
  slopeWeight: 0.5,
  crimeWeight: 0.7,
  floodWeight: 0.6,
  wildfireWeight: 0.6,
  taxWeight: 0.5,
  schoolWeight: 0.5,
  parkWeight: 0.4,
  childcareWeight: 0.4,
  priceDeltaWeight: 0.6,
}

function geminiWeights(_profile: UserProfile): ProfileWeights {
  console.log('geminiWeights called')
  return DEFAULT_WEIGHTS
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CivicEstate background] received:', message, 'from:', sender)

  if (message.type === 'GEOCODE_WORK_LOCATION') {
    const address = message.payload as string
    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'OK' && data.results[0]) {
          const { lat, lng } = data.results[0].geometry.location
          sendResponse({ lat, lon: lng })
        } else {
          sendResponse({ error: true })
        }
      })
      .catch(() => sendResponse({ error: true }))
    return true
  }

  if (message.type === 'SAVE_PROFILE') {
    const weights = geminiWeights(message.payload as UserProfile)
    chrome.storage.local.set({ profileWeights: weights })
    sendResponse({ status: 'background-received' })
    return true
  }

  sendResponse({ status: 'background-received' })
  return true
})
