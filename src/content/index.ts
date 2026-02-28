chrome.runtime.sendMessage(
  { type: 'content-ready', url: window.location.href },
  (response) => {
    console.log('[CivicEstate content] background responded:', response)
  }
)
