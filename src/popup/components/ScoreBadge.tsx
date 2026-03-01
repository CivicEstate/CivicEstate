import React from 'react'

interface ScoreBadgeProps {
  label: string
  score: number | null
  delta?: number | null // positive = above Irvine avg, negative = below
  size?: 'sm' | 'md'
}

function getScoreColor(score: number): { bar: string; text: string; bg: string } {
  if (score >= 9) return { bar: '#22c55e', text: '#16a34a', bg: '#f0fdf4' }
  if (score >= 7) return { bar: '#4ade80', text: '#15803d', bg: '#f0fdf4' }
  if (score >= 5) return { bar: '#f97316', text: '#c2410c', bg: '#fff7ed' }
  return { bar: '#ef4444', text: '#b91c1c', bg: '#fef2f2' }
}

export default function ScoreBadge({ label, score, delta, size = 'md' }: ScoreBadgeProps) {
  const isSm = size === 'sm'

  if (score === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: isSm ? 60 : 70 }}>
        <span style={{
          fontSize: isSm ? 9 : 10,
          fontWeight: 600,
          color: '#9ca3af',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <div style={{
          height: isSm ? 4 : 6,
          borderRadius: 99,
          background: '#e5e7eb',
          width: '100%',
        }} />
        <span style={{ fontSize: 9, color: '#d1d5db' }}>—</span>
      </div>
    )
  }

  const { bar, text, bg } = getScoreColor(score)
  const pct = Math.min(100, Math.max(0, (score / 10) * 100))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: isSm ? 60 : 70 }}>
      {/* Label */}
      <span style={{
        fontSize: isSm ? 9 : 10,
        fontWeight: 600,
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>

      {/* Bar + score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{
          flex: 1,
          height: isSm ? 4 : 6,
          borderRadius: 99,
          background: '#e5e7eb',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 99,
            background: bar,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{
          fontSize: isSm ? 10 : 12,
          fontWeight: 700,
          color: text,
          minWidth: 20,
          textAlign: 'right',
          background: bg,
          borderRadius: 4,
          padding: '0 3px',
        }}>
          {score.toFixed(1)}
        </span>
      </div>

      {/* Delta */}
      {delta !== undefined && delta !== null && (
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          color: delta >= 0 ? '#16a34a' : '#dc2626',
          letterSpacing: '0.02em',
        }}>
          {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{delta.toFixed(1)} vs Irvine avg
        </span>
      )}
    </div>
  )
}
