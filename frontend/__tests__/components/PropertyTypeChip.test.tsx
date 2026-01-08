import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PropertyTypeChip } from '@/components/PropertyTypeChip'

describe('PropertyTypeChip', () => {
  const mockPropertyType = {
    id: 1,
    name: 'Residential',
    color: '#22C55E',
    icon: 'home',
  }

  it('renders the property type name', () => {
    render(<PropertyTypeChip propertyType={mockPropertyType} />)
    expect(screen.getByText('Residential')).toBeInTheDocument()
  })

  it('applies the correct background color', () => {
    render(<PropertyTypeChip propertyType={mockPropertyType} />)
    const chip = screen.getByTestId('property-type-chip')
    expect(chip).toHaveStyle({ backgroundColor: '#22C55E' })
  })

  it('renders different property types correctly', () => {
    const commercialType = {
      id: 2,
      name: 'Commercial',
      color: '#3B82F6',
      icon: 'building',
    }
    render(<PropertyTypeChip propertyType={commercialType} />)
    expect(screen.getByText('Commercial')).toBeInTheDocument()
  })
})
