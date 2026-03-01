import React from 'react'
import { Phase1Result, CardState } from '../../types'
import ScoreBadge from './ScoreBadge'
import { SkeletonCard, UnverifiedCard } from './LoadingStates'
import { IRVINE_AVERAGES } from '../../background/scoring/irvineAverages'

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`
  return `$${(price / 1_000).toFixed(0)}K`
}

function formatCommute(minutes: number | null): string {
  if (minutes === null) return 'N/A'
  return `${minutes}min`
}

function formatTax(tax: number | null): string {
  if (tax === null) return 'N/A'
  return `$${tax.toLocaleString()}/yr`
}

function streetOnly(address: string): string {
  // Return just the street portion before the first comma
  return address.split(',')[0] ?? address
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface PropertyCardProps {
  result: Phase1Result
  cardState: CardState
  onClick: (zpid: string) => void
  commuteMode?: 'drives' | 'transit' | 'walk'
  batchAverages?: Phase1Result['scores'] | null
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function PropertyCard({
  result,
  cardState,
  onClick,
  commuteMode = 'drives',
  batchAverages,
}: PropertyCardProps) {

  // Delegate to skeleton / unverified states
  if (cardState === CardState.LOADING || cardState === CardState.IDLE) {
    return <SkeletonCard />
  }

  if (cardState === CardState.ERROR) {
    return <UnverifiedCard address={result.rawAddress} />
  }

  // Pick the right commute time to highlight
  const commuteTime =
    commuteMode === 'transit'
      ? result.commute.transit
      : commuteMode === 'walk'
      ? result.commute.walk
      : result.commute.carPeak

  // Score deltas — prefer batch averages from current search, fall back to Irvine constants
  const avgs = batchAverages ?? IRVINE_AVERAGES
  const deltas = {
    lifestyle: result.scores.lifestyle - avgs.lifestyle,
    accessibility: result.scores.accessibility - avgs.accessibility,
    family: result.scores.family - avgs.family,
    riskCost: result.scores.riskCost - avgs.riskCost,
    overall: result.scores.overall - avgs.overall,
  }

  const isPhase2Loading = cardState === CardState.PHASE2_LOADING
  const isPhase2Done = cardState === CardState.PHASE2_COMPLETE

  return (
    <div
      role="button"
      aria-label={`View details for ${result.rawAddress}`}
      tabIndex={0}
      onClick={() => onClick(result.zpid)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(result.zpid)}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '12px 14px',
        background: '#fff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        position: 'relative',
        // Visual cue if Phase 2 is running for this card
        ...(isPhase2Loading && { borderColor: '#6366f1', boxShadow: '0 0 0 2px rgba(99,102,241,0.15)' }),
        ...(isPhase2Done && { borderColor: '#22c55e' }),
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = '#9ca3af'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isPhase2Loading
          ? '0 0 0 2px rgba(99,102,241,0.15)'
          : 'none'
        ;(e.currentTarget as HTMLDivElement).style.borderColor = isPhase2Loading
          ? '#6366f1'
          : isPhase2Done
          ? '#22c55e'
          : '#e5e7eb'
      }}
    >

      {/* ── Header: address + price ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#111827',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {streetOnly(result.rawAddress)}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
            {result.beds}bd · {result.baths}ba
            {result.sqft ? ` · ${result.sqft.toLocaleString()} sqft` : ''}
            {result.yearBuilt ? ` · Built ${result.yearBuilt}` : ''}
          </div>
        </div>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#1d4ed8',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.02em',
        }}>
          {formatPrice(result.price)}
        </div>
      </div>

      {/* ── Price delta flag ── */}
      {result.priceDeltaFlag && result.priceDelta !== null && (
        <div style={{
          fontSize: 10,
          color: result.priceDelta > 0 ? '#b91c1c' : '#15803d',
          fontWeight: 600,
          marginTop: -6,
        }}>
          {result.priceDelta > 0 ? '⚠️ Priced above' : '💰 Priced below'} Zestimate by{' '}
          ${Math.abs(result.priceDelta).toLocaleString()}
        </div>
      )}

      {/* ── Five score badges ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <ScoreBadge label="🌟 Lifestyle" score={result.scores.lifestyle} delta={deltas.lifestyle} size="sm" />
        <ScoreBadge label="🚇 Access" score={result.scores.accessibility} delta={deltas.accessibility} size="sm" />
        <ScoreBadge label="🏫 Family" score={result.scores.family} delta={deltas.family} size="sm" />
        <ScoreBadge label="🛡️ Risk" score={result.scores.riskCost} delta={deltas.riskCost} size="sm" />
        <ScoreBadge label="⭐ Overall" score={result.scores.overall} delta={deltas.overall} size="sm" />
      </div>

      {/* ── Quick-scan stats row ── */}
      <div style={{
        display: 'flex',
        gap: 12,
        paddingTop: 8,
        borderTop: '1px solid #f3f4f6',
        flexWrap: 'wrap',
      }}>
        <Stat
          icon="🚗"
          label="Commute"
          value={formatCommute(commuteTime)}
          highlight={commuteTime !== null && commuteTime <= 20}
        />
        <Stat
          icon="🔒"
          label="Crime"
          value={result.crimeGrade ?? 'N/A'}
          highlight={result.crimeGrade !== null && ['A+','A','A-'].includes(result.crimeGrade)}
        />
        <Stat
          icon="💸"
          label="Tax"
          value={formatTax(result.annualTax)}
        />
        {result.wildfireHazard && (
          <Stat
            icon="🔥"
            label="Fire"
            value={result.wildfireHazard}
            warn={result.wildfireHazard.toLowerCase().includes('high')}
          />
        )}
      </div>

      {/* ── Phase 2 loading indicator ── */}
      {isPhase2Loading && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 10,
          fontSize: 9,
          color: '#6366f1',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          Generating insights…
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}

// ─── Tiny stat sub-component ────────────────────────────────────────────────
function Stat({ icon, label, value, highlight, warn }: {
  icon: string
  label: string
  value: string
  highlight?: boolean
  warn?: boolean
}) {
  const color = warn ? '#b91c1c' : highlight ? '#15803d' : '#6b7280'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 10 }}>{icon}</span>
      <span style={{ fontSize: 9, color: '#9ca3af' }}>{label}:</span>
      <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}
