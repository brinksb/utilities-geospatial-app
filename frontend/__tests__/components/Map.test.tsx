import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock maplibre-gl since it requires WebGL
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(),
    NavigationControl: vi.fn(),
  },
}))

// Mock react-map-gl with useControl
vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  NavigationControl: () => <div data-testid="navigation-control" />,
  useControl: vi.fn(() => ({ setProps: vi.fn() })),
}))

// Mock deck.gl
vi.mock('@deck.gl/mapbox', () => ({
  MapboxOverlay: vi.fn().mockImplementation(() => ({
    setProps: vi.fn(),
  })),
}))

vi.mock('@deck.gl/geo-layers', () => ({
  MVTLayer: vi.fn(),
}))

vi.mock('@deck.gl/layers', () => ({
  GeoJsonLayer: vi.fn(),
}))

import { PropertyMap } from '@/components/PropertyMap'

describe('PropertyMap', () => {
  it('renders the map container', () => {
    render(<PropertyMap />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders with custom initial view', () => {
    render(
      <PropertyMap
        initialViewState={{
          longitude: -122.4,
          latitude: 37.8,
          zoom: 12,
        }}
      />
    )
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('accepts onPropertyClick callback', () => {
    const handleClick = vi.fn()
    render(<PropertyMap onPropertyClick={handleClick} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders navigation controls', () => {
    render(<PropertyMap />)
    expect(screen.getByTestId('navigation-control')).toBeInTheDocument()
  })
})
