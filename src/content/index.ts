console.log('[CE] content script loaded')
import { detectPageType, findNextData, extractListings } from '../utils/domParser'
import { Phase1Result } from '../types/index'

// Fallback averages — must match background/scoring/irvineAverages.ts
const IRVINE_AVERAGES = { lifestyle: 7.2, accessibility: 6.8, family: 8.1, riskCost: 6.5, overall: 7.1 }

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number): { bar: string; text: string; bg: string } {
  if (score >= 9) return { bar: '#22c55e', text: '#16a34a', bg: '#f0fdf4' }
  if (score >= 7) return { bar: '#4ade80', text: '#15803d', bg: '#f0fdf4' }
  if (score >= 5) return { bar: '#f97316', text: '#c2410c', bg: '#fff7ed' }
  return { bar: '#ef4444', text: '#b91c1c', bg: '#fef2f2' }
}

function formatCommute(minutes: number | null): string {
  if (minutes === null) return 'N/A'
  return `${Math.round(minutes)}min`
}

function formatTax(tax: number | null): string {
  if (tax === null) return 'N/A'
  return `$${tax.toLocaleString()}/yr`
}

function badgeHtml(
  label: string,
  score: number,
  avg: number
): string {
  const { bar, text, bg } = getScoreColor(score)
  const pct = Math.min(100, Math.max(0, (score / 10) * 100))
  const delta = score - avg
  const dSign = delta >= 0 ? '+' : ''
  const dArrow = delta >= 0 ? '▲' : '▼'
  const dColor = delta >= 0 ? '#16a34a' : '#dc2626'

  return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;overflow:hidden">
    <span style="font-size:8px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>
    <div style="display:flex;align-items:center;gap:3px">
      <div style="flex:1;height:4px;border-radius:99px;background:#e5e7eb;overflow:hidden">
        <div style="width:${pct}%;height:100%;border-radius:99px;background:${bar}"></div>
      </div>
      <span style="font-size:11px;font-weight:700;color:${text};min-width:18px;text-align:right;background:${bg};border-radius:4px;padding:0 2px">${score.toFixed(1)}</span>
    </div>
    <span style="font-size:10px;font-weight:700;color:${dColor};white-space:nowrap">${dArrow}${dSign}${delta.toFixed(1)}</span>
  </div>`
}

function statHtml(icon: string, label: string, value: string, highlight: boolean, warn: boolean): string {
  const color = warn ? '#b91c1c' : highlight ? '#15803d' : '#6b7280'
  return `<div style="display:flex;align-items:center;gap:3px">
    <span style="font-size:10px">${icon}</span>
    <span style="font-size:9px;color:#9ca3af">${label}:</span>
    <span style="font-size:10px;font-weight:700;color:${color}">${value}</span>
  </div>`
}

function injectScorePanel(
  zpid: string,
  result: Phase1Result,
  avgs: typeof IRVINE_AVERAGES
): void {
  console.log('[CE] injectScorePanel called for zpid:', zpid)
  // Guard: don't inject twice
  if (document.getElementById(`ce-scores-${zpid}`)) return

  const tile = document.getElementById(`zpid_${zpid}`)
  console.log('[CE] tile element found:', !!tile)
  if (!tile) {
    console.warn(`[CivicEstate] Tile not found for zpid_${zpid}`)
    return
  }

  const dataWrapper = tile.querySelector('[data-c11n-component="PropertyCard.DataWrapper"]')
  console.log('[CE] dataWrapper found:', !!dataWrapper)
  if (!dataWrapper) {
    console.warn(`[CivicEstate] DataWrapper not found for zpid_${zpid}`)
    return
  }

  // Only adjust the tile itself — don't walk ancestors (breaks Zillow's virtualization)
  tile.style.setProperty('height', 'auto', 'important')
  tile.style.setProperty('overflow', 'visible', 'important')

  const panel = document.createElement('div')
  panel.id = `ce-scores-${zpid}`
  panel.style.cssText = `
    padding: 4px 8px;
    border-top: 1px solid #e5e7eb;
    font-family: system-ui, -apple-system, sans-serif;
    background: #fff;
  `

  const badges = [
    { label: 'Lifestyle', key: 'lifestyle' as const },
    { label: 'Access', key: 'accessibility' as const },
    { label: 'Family', key: 'family' as const },
    { label: 'Risk', key: 'riskCost' as const },
    { label: 'Overall', key: 'overall' as const },
  ]

  const badgesHtml = badges
    .map((b) => badgeHtml(b.label, result.scores[b.key], avgs[b.key]))
    .join('')

  const commuteTime = result.commute.carPeak
  const crimeGrade = result.crimeGrade
  const isGoodCrime = crimeGrade !== null && ['A+', 'A', 'A-'].includes(crimeGrade)
  const isHighFire = result.wildfireHazard?.toLowerCase().includes('high') ?? false

  let statsHtml = ''
  statsHtml += statHtml('🚗', 'Commute', formatCommute(commuteTime), commuteTime !== null && commuteTime <= 20, false)
  statsHtml += statHtml('🔒', 'Crime', crimeGrade ?? 'N/A', isGoodCrime, false)
  statsHtml += statHtml('💸', 'Tax', formatTax(result.annualTax), false, false)
  if (result.wildfireHazard) {
    statsHtml += statHtml('🔥', 'Fire', result.wildfireHazard, false, isHighFire)
  }

  panel.innerHTML = `
    <div style="display:flex;gap:4px">${badgesHtml}</div>
    <div style="display:flex;gap:8px;padding-top:4px;margin-top:4px;border-top:1px solid #f3f4f6;flex-wrap:wrap">${statsHtml}</div>
  `

  // Append as last child of DataWrapper — after address/realtor, won't overlap photos
  console.log('[CE] appending panel for zpid:', zpid)
  dataWrapper.appendChild(panel)

  // Click → trigger Phase 2
  panel.style.cursor = 'pointer'
  const clickHandler = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  // Intercept clicks on any anchor inside the panel before they bubble
  panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', clickHandler, true))
  const mainClickHandler = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    console.log('[CE] panel clicked for zpid:', zpid)
    if (panel.dataset.loading === 'true') {
      console.log('[CE] already loading, ignoring click')
      return
    }
    panel.dataset.loading = 'true'
    panel.style.border = '2px solid #6366f1'

    const status = document.createElement('div')
    status.id = `ce-phase2-status-${zpid}`
    status.style.cssText = 'font-size:11px;color:#6366f1;font-weight:600;padding:4px 0 0;'
    status.textContent = 'Generating insights...'
    panel.appendChild(status)

    console.log('[CE] sending TRIGGER_PHASE2 for zpid:', zpid)
    chrome.runtime.sendMessage({ type: 'TRIGGER_PHASE2', zpid }, (resp) => {
      console.log('[CE] TRIGGER_PHASE2 response:', resp)
    })
  }
  panel.addEventListener('click', mainClickHandler, true)
}

// ── State for current search session ─────────────────────────────────────────

let currentZpidList: string[] = []
let extractedZpids = new Set<string>()
let cachedBatchAverages: typeof IRVINE_AVERAGES | null = null
let resultCache = new Map<string, Phase1Result>()
let pollInterval: ReturnType<typeof setInterval> | null = null
let observer: MutationObserver | null = null
let storageListener: ((changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void) | null = null
let lastUrl = ''

function cleanupPreviousSession(): void {
  // Stop polling
  if (pollInterval !== null) {
    clearInterval(pollInterval)
    pollInterval = null
  }

  // Disconnect observer
  if (observer !== null) {
    observer.disconnect()
    observer = null
  }

  // Remove storage listener
  if (storageListener !== null) {
    chrome.storage.onChanged.removeListener(storageListener)
    storageListener = null
  }

  // Remove injected panels from DOM
  document.querySelectorAll('[id^="ce-scores-"]').forEach((el) => el.remove())

  // Reset cached state
  currentZpidList = []
  extractedZpids = new Set()
  cachedBatchAverages = null
  resultCache = new Map()
}

// ── Main ─────────────────────────────────────────────────────────────────────

function runContentScript(): void {
  const url = window.location.href

  // Skip if URL hasn't changed (duplicate call)
  if (url === lastUrl) return
  lastUrl = url

  // Clean up previous session state before starting fresh
  cleanupPreviousSession()

  const pageType = detectPageType(url)
  console.log(`[CivicEstate] Page type: ${pageType} — URL: ${url}`)

  if (pageType === 'other') {
    console.log('[CivicEstate] Not a search or detail page, skipping.')
    return
  }

  if (pageType === 'detail') {
    console.log('[CivicEstate] Detail page detected, no extraction needed.')
    return
  }

  // pageType === 'search'
  const nextData = findNextData()

  if (!nextData) {
    console.log('[CivicEstate] No __NEXT_DATA__ found on this page.')
    return
  }

  const listings = extractListings(nextData)
  console.log(`[CivicEstate] Extracted ${listings.length} listings:`, listings)

  if (listings.length === 0) {
    console.warn('[CivicEstate] Zero listings extracted — check __NEXT_DATA__ structure.')
    return
  }

  chrome.storage.local.set({ currentListings: listings })
  chrome.runtime.sendMessage(
    { type: 'LISTINGS_EXTRACTED', payload: listings },
    (response) => {
      console.log('[CivicEstate] Background responded to LISTINGS_EXTRACTED:', response)
    }
  )

  // Track extracted zpids so we know which storage changes to react to
  currentZpidList = listings.map((l) => l.zpid)
  extractedZpids = new Set(currentZpidList)

  // Try to inject all cached results that don't have panels yet
  function tryInjectAll(): void {
    for (const [zpid, result] of resultCache) {
      if (!document.getElementById(`ce-scores-${zpid}`)) {
        injectScorePanel(zpid, result, cachedBatchAverages ?? IRVINE_AVERAGES)
      }
    }
  }

  // Poll storage for results and inject — covers race conditions + lazy-loaded tiles
  function pollAndInject(): void {
    chrome.storage.local.get([...currentZpidList, 'batchAverages'], (data) => {
      if (data.batchAverages) {
        cachedBatchAverages = data.batchAverages as typeof IRVINE_AVERAGES
      }
      for (const zpid of currentZpidList) {
        const result = data[zpid] as Phase1Result | undefined
        if (result?.scores) {
          resultCache.set(zpid, result)
        }
      }
      tryInjectAll()
    })
  }

  // Listen for Phase 1 results via chrome.storage.onChanged (instant reaction)
  storageListener = (changes, areaName) => {
    if (areaName !== 'local') return

    if (changes.batchAverages?.newValue) {
      cachedBatchAverages = changes.batchAverages.newValue as typeof IRVINE_AVERAGES
    }

    for (const key of Object.keys(changes)) {
      if (!extractedZpids.has(key)) continue
      const result = changes[key]?.newValue as Phase1Result | undefined
      if (!result?.scores) continue
      resultCache.set(key, result)

      // Phase 2 result — has geminiOutput key
      if ('geminiOutput' in result) {
        console.log('[CE] Phase2 storage change received for zpid:', key, 'geminiOutput:', !!(result as any).geminiOutput)
        const panel = document.getElementById(`ce-scores-${key}`)
        if (!panel) { console.warn('[CE] panel not found for Phase2 update, zpid:', key); continue }
        delete panel.dataset.loading

        const statusEl = document.getElementById(`ce-phase2-status-${key}`)
        if (statusEl) statusEl.remove()

        if ((result as any).geminiOutput) {
          const gemini = (result as any).geminiOutput as import('../types/index').GeminiOutput
          panel.style.border = '2px solid #22c55e'

          const narrative = document.createElement('p')
          narrative.style.cssText = 'font-size:11px;color:#374151;margin:6px 0 4px;line-height:1.4;'
          narrative.textContent = gemini.narrative
          panel.appendChild(narrative)

          if (gemini.highlights.length > 0) {
            const list = document.createElement('ul')
            list.style.cssText = 'margin:0 0 4px;padding-left:16px;font-size:10px;color:#4b5563;'
            for (const h of gemini.highlights) {
              const li = document.createElement('li')
              li.textContent = h
              list.appendChild(li)
            }
            panel.appendChild(list)
          }

          if (gemini.agentQuestions.length > 0) {
            const q = document.createElement('div')
            q.style.cssText = 'font-size:10px;color:#6366f1;font-style:italic;margin-top:2px;'
            q.textContent = `Ask your agent: ${gemini.agentQuestions[0]}`
            panel.appendChild(q)
          }
        } else {
          panel.style.border = '2px solid #f59e0b'
          const msg = document.createElement('div')
          msg.style.cssText = 'font-size:11px;color:#92400e;font-weight:600;padding:4px 0 0;'
          msg.textContent = 'AI insights unavailable'
          panel.appendChild(msg)
        }
        continue
      }

      injectScorePanel(key, result, cachedBatchAverages ?? IRVINE_AVERAGES)
    }
  }
  chrome.storage.onChanged.addListener(storageListener)

  // MutationObserver: retry injection when Zillow adds/recycles tiles
  // Debounced to avoid firing hundreds of times per second on Zillow's React mutations
  let mutationTimer: ReturnType<typeof setTimeout> | null = null
  observer = new MutationObserver(() => {
    if (resultCache.size === 0) return
    if (mutationTimer) clearTimeout(mutationTimer)
    mutationTimer = setTimeout(() => { mutationTimer = null; tryInjectAll() }, 300)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // Periodic poll: catch anything missed by listener or observer
  pollInterval = setInterval(() => {
    pollAndInject()
    // Stop polling once all listings have panels
    const allInjected = currentZpidList.every((z) => document.getElementById(`ce-scores-${z}`))
    if (allInjected) {
      console.log('[CivicEstate] All listings injected, stopping poll')
      if (pollInterval !== null) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }
  }, 2000)

  // Initial poll to catch results already in storage
  pollAndInject()
}

// ── SPA navigation detection ─────────────────────────────────────────────────
// Zillow is a Next.js SPA — URL changes don't reload the content script.
// Detect navigation and re-run extraction with fresh state.

function watchForNavigation(): void {
  // Intercept pushState / replaceState
  const origPushState = history.pushState.bind(history)
  const origReplaceState = history.replaceState.bind(history)

  history.pushState = function (...args) {
    origPushState(...args)
    setTimeout(runContentScript, 300)
  }
  history.replaceState = function (...args) {
    origReplaceState(...args)
    setTimeout(runContentScript, 300)
  }

  window.addEventListener('popstate', () => {
    setTimeout(runContentScript, 300)
  })
}

// Initial run
runContentScript()
watchForNavigation()
