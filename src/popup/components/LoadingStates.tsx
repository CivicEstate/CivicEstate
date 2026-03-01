import React from 'react'

// Reusable shimmer block
function Shimmer({ width = '100%', height = 12, borderRadius = 6 }: {
  width?: string | number
  height?: number
  borderRadius?: number
}) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

export function SkeletonCard() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '12px 14px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: 0.85,
      }}>
        {/* Address + price row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
            <Shimmer width="65%" height={10} />
            <Shimmer width="40%" height={8} />
          </div>
          <Shimmer width={72} height={20} borderRadius={8} />
        </div>

        {/* Beds/baths/sqft row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Shimmer width={40} height={8} />
          <Shimmer width={40} height={8} />
          <Shimmer width={55} height={8} />
        </div>

        {/* Score bars */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[70, 60, 75, 65, 70].map((w, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Shimmer width="80%" height={7} />
              <Shimmer width={`${w}%`} height={5} borderRadius={99} />
              <Shimmer width="50%" height={6} />
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{
          display: 'flex',
          gap: 10,
          paddingTop: 6,
          borderTop: '1px solid #f3f4f6',
        }}>
          <Shimmer width={60} height={8} />
          <Shimmer width={40} height={8} />
          <Shimmer width={55} height={8} />
        </div>
      </div>
    </>
  )
}

// Unverified address state — muted card with label
export function UnverifiedCard({ address }: { address: string }) {
  return (
    <div style={{
      border: '1px dashed #d1d5db',
      borderRadius: 12,
      padding: '12px 14px',
      background: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      opacity: 0.7,
    }}>
      <span style={{ fontSize: 16 }}>⚠️</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Address unverified</div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{address}</div>
      </div>
    </div>
  )
}
