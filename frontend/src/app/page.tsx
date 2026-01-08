'use client'

import { useState, useEffect } from 'react'
import { PropertyMap } from '@/components/PropertyMap'
import { PropertyCard } from '@/components/PropertyCard'
import type { Property } from '@/types'
import type { FeatureCollection } from 'geojson'

export default function Home() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [networkOverlay, setNetworkOverlay] = useState<FeatureCollection | null>(null)

  useEffect(() => {
    fetch('/api/properties')
      .then((res) => res.json())
      .then((data) => {
        setProperties(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch properties:', err)
        setLoading(false)
      })
  }, [])

  /**
   * Fetch network overlay for given coordinates.
   * Demo feature: shows nearby network edges when a property is selected.
   */
  const fetchNetworkOverlay = async (lon: number, lat: number) => {
    try {
      const nearestRes = await fetch(`/api/graph/nearest_edge?lon=${lon}&lat=${lat}`)
      if (nearestRes.ok) {
        const nearest = await nearestRes.json()
        const edgeId = nearest.properties?.edge_id
        if (edgeId) {
          const networkRes = await fetch(`/api/graph/nearby_edges/${edgeId}?hops=3`)
          if (networkRes.ok) {
            const network = await networkRes.json()
            setNetworkOverlay(network)
            return
          }
        }
      }
    } catch (err) {
      console.error('Error fetching network overlay:', err)
    }
    setNetworkOverlay(null)
  }

  /**
   * Handle property selection from sidebar.
   * Demo feature: also fetches network overlay using property coordinates.
   */
  const handleSidebarPropertyClick = async (property: Property) => {
    setSelectedProperty(property)

    // Fetch network overlay if coordinates available
    if (property.longitude && property.latitude) {
      await fetchNetworkOverlay(property.longitude, property.latitude)
    } else {
      setNetworkOverlay(null)
    }
  }

  /**
   * Handle property click from map (MVT feature).
   */
  const handleMapPropertyClick = async (feature: any) => {
    if (feature.properties?.id) {
      try {
        // Fetch property details
        const propertyRes = await fetch(`/api/properties/${feature.properties.id}`)
        const property = await propertyRes.json()
        setSelectedProperty(property)

        // Fetch nearby network (using feature coordinates from tile)
        const coords = feature.geometry?.coordinates
        if (coords) {
          const [lon, lat] = coords
          await fetchNetworkOverlay(lon, lat)
        }
      } catch (err) {
        console.error('Error handling map property click:', err)
      }
    }
  }

  const handleBackClick = () => {
    setSelectedProperty(null)
    setNetworkOverlay(null)
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        data-testid="sidebar"
        style={{
          width: '360px',
          borderRight: '1px solid #e5e7eb',
          overflow: 'auto',
          padding: '16px',
          backgroundColor: '#f9fafb',
        }}
      >
        <h1 style={{ margin: '0 0 16px', fontSize: '24px' }}>Property Viewer</h1>

        {selectedProperty ? (
          <div data-testid="selected-property">
            <button
              data-testid="back-button"
              onClick={handleBackClick}
              style={{
                marginBottom: '16px',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              &larr; Back to list
            </button>
            <PropertyCard property={selectedProperty} />
          </div>
        ) : (
          <div data-testid="property-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <p data-testid="loading-message">Loading properties...</p>
            ) : properties.length === 0 ? (
              <p data-testid="empty-message">No properties found. Create some via the API!</p>
            ) : (
              properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  onClick={handleSidebarPropertyClick}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div data-testid="map-container" style={{ flex: 1 }}>
        <PropertyMap
          onPropertyClick={handleMapPropertyClick}
          geoJsonOverlay={networkOverlay}
        />
      </div>
    </div>
  )
}
