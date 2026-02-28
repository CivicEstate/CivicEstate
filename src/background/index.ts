chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CivicEstate background] received:', message, 'from:', sender)
  sendResponse({ status: 'background-received' })
  return true
})
