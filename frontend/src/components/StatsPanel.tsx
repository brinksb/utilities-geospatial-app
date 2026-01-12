'use client'

import { useState, useEffect } from 'react'
import { showToast } from '@/utils/toast'

/**
 * Network statistics response from the API.
 */
interface NetworkStats {
  totals: {
    pipe_count: number
    pipe_length_m: number
    service_count: number
    service_length_m: number
    building_count: number
  }
  by_material: Array<{
    material: string
    count: number
    total_length_m: number
  }>
  by_class: Array<{
    class: string
    count: number
    total_length_m: number
    avg_diameter_mm: number
  }>
  by_age: Array<{
    era: string
    count: number
    total_length_m: number
  }>
}

interface StatsPanelProps {
  collapsed?: boolean
  onToggle?: () => void
}

/**
 * StatsPanel - Displays aggregate network statistics.
 *
 * Shows totals and breakdowns by material, class, and age in a
 * collapsible panel styled to match the Simpsons theme.
 */
export function StatsPanel({ collapsed = false, onToggle }: StatsPanelProps) {
  const [stats, setStats] = useState<NetworkStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/network/stats')
      if (!res.ok) throw new Error('Failed to load stats')
      const data = await res.json()
      setStats(data)
      setError(null)
    } catch (err) {
      setError('Failed to load network statistics')
      showToast.error('Failed to load network statistics')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div style={panelStyle} data-testid="stats-panel">
        <PanelHeader title="Network Stats" onToggle={onToggle} />
        <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>Loading...</p>
      </div>
    )
  }

  // Error state
  if (error || !stats) {
    return (
      <div style={panelStyle} data-testid="stats-panel">
        <PanelHeader title="Network Stats" onToggle={onToggle} />
        <p style={{ color: '#FF6347', fontSize: '12px', margin: 0 }}>{error}</p>
      </div>
    )
  }

  // Collapsed state
  if (collapsed) {
    return (
      <div
        style={{ ...panelStyle, cursor: 'pointer' }}
        onClick={onToggle}
        data-testid="stats-panel"
      >
        <PanelHeader title="Network Stats" collapsed onToggle={onToggle} />
      </div>
    )
  }

  return (
    <div style={panelStyle} data-testid="stats-panel">
      <PanelHeader title="Network Stats" onToggle={onToggle} />

      {/* Totals */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>Totals</h4>
        <StatRow
          label="Pipes"
          value={stats.totals.pipe_count.toLocaleString()}
        />
        <StatRow
          label="Pipe Length"
          value={`${(stats.totals.pipe_length_m / 1000).toFixed(1)} km`}
        />
        <StatRow
          label="Service Lines"
          value={stats.totals.service_count.toLocaleString()}
        />
        <StatRow
          label="Buildings"
          value={stats.totals.building_count.toLocaleString()}
        />
      </div>

      {/* By Material */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>By Material</h4>
        {stats.by_material.map((m) => (
          <StatRow
            key={m.material}
            label={m.material}
            value={`${m.count} (${(m.total_length_m / 1000).toFixed(1)} km)`}
          />
        ))}
      </div>

      {/* By Class */}
      <div style={sectionStyle}>
        <h4 style={sectionTitleStyle}>By Class</h4>
        {stats.by_class.map((c) => (
          <StatRow
            key={c.class}
            label={c.class}
            value={`${c.count} pipes, avg ${c.avg_diameter_mm}mm`}
          />
        ))}
      </div>

      {/* By Age */}
      <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <h4 style={sectionTitleStyle}>By Install Era</h4>
        {stats.by_age.map((a) => (
          <StatRow key={a.era} label={a.era} value={`${a.count} pipes`} />
        ))}
      </div>
    </div>
  )
}

/**
 * Panel header with title and collapse toggle.
 */
function PanelHeader({
  title,
  collapsed = false,
  onToggle,
}: {
  title: string
  collapsed?: boolean
  onToggle?: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: collapsed ? 0 : '12px',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span>📊</span> {title}
      </h3>
      {onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '4px',
          }}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      )}
    </div>
  )
}

/**
 * Single row displaying a stat label and value.
 */
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        padding: '3px 0',
      }}
    >
      <span style={{ color: '#666' }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// Styles
const panelStyle: React.CSSProperties = {
  padding: '12px',
  backgroundColor: '#fff',
  borderRadius: '8px',
  border: '2px solid #0078D4',
  marginTop: '16px',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '12px',
  paddingBottom: '10px',
  borderBottom: '1px dashed #e5e7eb',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: '12px',
  fontWeight: 600,
  color: '#333',
}
