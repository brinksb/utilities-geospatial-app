'use client'

import { DraggablePanel } from './DraggablePanel'

/**
 * Properties available from the pipe MVT tiles.
 * Matches the columns exposed in synth_pipes_mvt function.
 */
interface PipeProperties {
  id: number
  class: string
  diameter_mm: number
  material: string
  pressure_class: string
  install_year: number
  length_m: number
}

interface PipeInspectorProps {
  pipe: PipeProperties
  onClose: () => void
}

// Material display names
const MATERIAL_NAMES: Record<string, string> = {
  Steel: 'Steel',
  PE: 'Polyethylene (PE)',
  PVC: 'PVC',
  DI: 'Ductile Iron',
  HDPE: 'High-Density PE',
}

// Pressure class display names
const PRESSURE_NAMES: Record<string, string> = {
  HP: 'High Pressure',
  MP: 'Medium Pressure',
  LP: 'Low Pressure',
}

/**
 * Get age-based color for visual indicator.
 * Older pipes get warmer (more urgent) colors.
 */
function getAgeColor(installYear: number): string {
  const age = new Date().getFullYear() - installYear
  if (age > 40) return '#FFCCCB' // Light red - very old
  if (age > 25) return '#FFFACD' // Light yellow - aging
  return '#E8F5E9' // Light green - relatively new
}

/**
 * Get age-based status text.
 */
function getAgeStatus(installYear: number): string {
  const age = new Date().getFullYear() - installYear
  if (age > 40) return 'Consider replacement'
  if (age > 25) return 'Schedule inspection'
  return 'Good condition'
}

export function PipeInspector({ pipe, onClose }: PipeInspectorProps) {
  const age = new Date().getFullYear() - pipe.install_year
  const isMain = pipe.class === 'main'

  return (
    <DraggablePanel
      title="Pipe Inspector"
      onClose={onClose}
      storageKey="pipe-inspector"
      defaultPosition={{ x: 400, y: 120 }}
    >
      <div data-testid="pipe-inspector-content" style={{ fontSize: '13px' }}>
        {/* Header with ID and class badge */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '3px solid #FED90F',
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>
            Pipe #{pipe.id}
          </span>
          <span
            style={{
              padding: '4px 12px',
              backgroundColor: isMain ? '#0078D4' : '#00A86B',
              color: '#fff',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            {pipe.class}
          </span>
        </div>

        {/* Properties grid */}
        <div style={{ display: 'grid', gap: '10px' }}>
          <PropertyRow
            label="Material"
            value={MATERIAL_NAMES[pipe.material] || pipe.material}
          />
          <PropertyRow
            label="Diameter"
            value={`${pipe.diameter_mm} mm`}
          />
          <PropertyRow
            label="Length"
            value={`${pipe.length_m.toFixed(1)} m`}
          />
          <PropertyRow
            label="Pressure Class"
            value={PRESSURE_NAMES[pipe.pressure_class] || pipe.pressure_class}
          />
          <PropertyRow
            label="Installed"
            value={pipe.install_year.toString()}
          />
        </div>

        {/* Age indicator card */}
        <div
          data-testid="age-indicator"
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: getAgeColor(pipe.install_year),
            borderRadius: '6px',
            border: '1px solid #ddd',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                {age} years old
              </div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                {getAgeStatus(pipe.install_year)}
              </div>
            </div>
            <div style={{ fontSize: '24px' }}>
              {age > 40 ? '🔧' : age > 25 ? '👀' : '✅'}
            </div>
          </div>
        </div>

        {/* Fun Simpsons-style note */}
        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: '#FED90F',
            borderRadius: '4px',
            fontSize: '10px',
            fontStyle: 'italic',
          }}
        >
          {isMain
            ? '"These main pipes are the backbone of Springfield!" - Waylon Smithers'
            : '"Secondary pipes: bringing water to every Kwik-E-Mart!" - Apu'}
        </div>
      </div>
    </DraggablePanel>
  )
}

/**
 * Single row in the properties display.
 */
function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}
