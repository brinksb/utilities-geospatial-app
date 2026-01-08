import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PropertyCard } from '@/components/PropertyCard'

describe('PropertyCard', () => {
  const mockProperty = {
    id: 1,
    name: 'Test Property',
    address: '123 Test Street',
    property_type_id: 1,
    property_type: {
      id: 1,
      name: 'Residential',
      color: '#22C55E',
      icon: 'home',
    },
    value: 500000,
  }

  it('renders the property name', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('Test Property')).toBeInTheDocument()
  })

  it('renders the property address', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('123 Test Street')).toBeInTheDocument()
  })

  it('renders the property type chip', () => {
    render(<PropertyCard property={mockProperty} />)
    expect(screen.getByText('Residential')).toBeInTheDocument()
  })

  it('renders the formatted value', () => {
    render(<PropertyCard property={mockProperty} />)
    // Should format as currency
    expect(screen.getByText(/500,000/)).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<PropertyCard property={mockProperty} onClick={handleClick} />)

    const card = screen.getByTestId('property-card')
    fireEvent.click(card)

    expect(handleClick).toHaveBeenCalledWith(mockProperty)
  })

  it('handles missing address gracefully', () => {
    const propertyNoAddress = { ...mockProperty, address: null }
    render(<PropertyCard property={propertyNoAddress} />)
    expect(screen.getByText('Test Property')).toBeInTheDocument()
  })
})
