import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Legend } from '@/components/Legend'
import { LegendItem } from '@/services/LegendService'

describe('Legend', () => {
  const testItems: LegendItem[] = [
    { label: 'Residential', color: '#22C55E' },
    { label: 'Commercial', color: '#3B82F6' },
    { label: 'Industrial', color: '#EF4444' },
  ]

  it('renders nothing when items is empty', () => {
    const { container } = render(<Legend items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders legend items', () => {
    render(<Legend items={testItems} />)
    expect(screen.getByTestId('legend')).toBeInTheDocument()
    expect(screen.getByTestId('legend-item-Residential')).toBeInTheDocument()
    expect(screen.getByTestId('legend-item-Commercial')).toBeInTheDocument()
    expect(screen.getByTestId('legend-item-Industrial')).toBeInTheDocument()
  })

  it('displays item labels', () => {
    render(<Legend items={testItems} />)
    expect(screen.getByText('Residential')).toBeInTheDocument()
    expect(screen.getByText('Commercial')).toBeInTheDocument()
    expect(screen.getByText('Industrial')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Legend title="Property Types" items={testItems} />)
    expect(screen.getByText('Property Types')).toBeInTheDocument()
  })

  it('does not render title when not provided', () => {
    render(<Legend items={testItems} />)
    expect(screen.queryByText('Property Types')).not.toBeInTheDocument()
  })
})
