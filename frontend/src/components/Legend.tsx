'use client'

import { LegendItem } from '@/services/LegendService'

interface LegendProps {
  title?: string
  items: LegendItem[]
}

export function Legend({ title, items }: LegendProps) {
  if (items.length === 0) return null

  return (
    <div
      data-testid="legend"
      style={{
        marginTop: '8px',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: '12px',
            color: '#6b7280',
            marginBottom: '4px',
          }}
        >
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            data-testid={`legend-item-${item.label}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: item.color,
                borderRadius: '2px',
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
