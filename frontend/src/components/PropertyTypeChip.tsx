import { PropertyType } from '@/types'

interface PropertyTypeChipProps {
  propertyType: PropertyType
}

export function PropertyTypeChip({ propertyType }: PropertyTypeChipProps) {
  return (
    <span
      data-testid="property-type-chip"
      style={{
        backgroundColor: propertyType.color,
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        display: 'inline-block',
      }}
    >
      {propertyType.name}
    </span>
  )
}
