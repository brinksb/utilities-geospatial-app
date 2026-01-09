import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the PropertyMap component since it uses WebGL
vi.mock('@/components/PropertyMap', () => ({
  PropertyMap: () => <div data-testid="mock-property-map">Map</div>,
}))

// Mock fetch for API calls
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([]),
  })
) as any

import Home from '@/app/page'

describe('Home Page', () => {
  it('renders the heading', () => {
    render(<Home />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SPRINGFIELD')
  })

  it('renders the map container', () => {
    render(<Home />)
    expect(screen.getByTestId('mock-property-map')).toBeInTheDocument()
  })
})
