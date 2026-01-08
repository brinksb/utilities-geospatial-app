import { Property } from '@/types'
import { PropertyTypeChip } from './PropertyTypeChip'

interface PropertyCardProps {
  property: Property
  onClick?: (property: Property) => void
}

function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function PropertyCard({ property, onClick }: PropertyCardProps) {
  return (
    <div
      data-testid="property-card"
      onClick={() => onClick?.(property)}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          {property.name}
        </h3>
        <PropertyTypeChip propertyType={property.property_type} />
      </div>

      {property.address && (
        <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '14px' }}>
          {property.address}
        </p>
      )}

      <p style={{ margin: '8px 0 0', fontSize: '18px', fontWeight: 600, color: '#059669' }}>
        {formatCurrency(property.value)}
      </p>
    </div>
  )
}
