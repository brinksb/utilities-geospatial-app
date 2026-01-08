'use client'

import { useState, useEffect, useMemo } from 'react'
import { PropertyMap } from '@/components/PropertyMap'
import { PropertyCard } from '@/components/PropertyCard'
import { LayerManager, LayerConfig, LayerPreset } from '@/services/LayerManager'
import { LegendService } from '@/services/LegendService'
import { Legend } from '@/components/Legend'
import { DraggablePanel } from '@/components/DraggablePanel'
import layersConfig from '@/config/layers.json'
import type { Property } from '@/types'
import type { FeatureCollection } from 'geojson'

// Initialize LayerManager singleton with presets
const layerManager = new LayerManager(
  layersConfig.layers as LayerConfig[],
  layersConfig.presets as LayerPreset[]
)

// Initialize LegendService
const legendService = new LegendService()

export default function Home() {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [networkOverlay, setNetworkOverlay] = useState<FeatureCollection | null>(null)
  const [, forceUpdate] = useState(0)

  // Subscribe to layer changes
  useEffect(() => {
    const unsubscribe = layerManager.subscribe(() => {
      forceUpdate(n => n + 1)
    })
    return unsubscribe
  }, [])

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

        {/* Layer Controls */}
        <div
          data-testid="layer-controls"
          style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Preset Buttons */}
          {layerManager.getPresets().length > 0 && (
            <div
              data-testid="layer-presets"
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {layerManager.getPresets().map((preset) => (
                <button
                  key={preset.id}
                  data-testid={`preset-${preset.id}`}
                  onClick={() => layerManager.applyPreset(preset.id)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid #d1d5db',
                    backgroundColor: layerManager.getActivePreset() === preset.id ? '#3B82F6' : '#fff',
                    color: layerManager.getActivePreset() === preset.id ? '#fff' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}

          <h2 style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280' }}>Layers</h2>
          {layerManager.getGroups().map((group) => (
            <div key={group.id} style={{ marginBottom: '8px' }}>
              <div
                data-testid={`layer-group-${group.id}`}
                onClick={() => layerManager.toggleGroup(group.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontWeight: 500,
                }}
              >
                <span style={{ marginRight: '8px', fontSize: '12px' }}>
                  {layerManager.isGroupExpanded(group.id) ? '▼' : '▶'}
                </span>
                {group.name}
              </div>
              {layerManager.isGroupExpanded(group.id) && (
                <div style={{ marginLeft: '20px' }}>
                  {layerManager.getGroupChildren(group.id).map((layer) => (
                    <label
                      key={layer.id}
                      data-testid={`layer-toggle-${layer.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 0',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={layer.visible}
                        onChange={() => layerManager.toggleVisibility(layer.id)}
                        style={{ marginRight: '8px' }}
                      />
                      {layer.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Legend for visible layers */}
          {layerManager.getVisibleLayers().map((layer) => {
            const items = legendService.getLegendForLayer(layer)
            return items.length > 0 ? (
              <Legend key={layer.id} title={layer.name} items={items} />
            ) : null
          })}
        </div>

        {/* Property list - always visible */}
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
      </div>

      {/* Map */}
      <div data-testid="map-container" style={{ flex: 1 }}>
        <PropertyMap
          onPropertyClick={handleMapPropertyClick}
          geoJsonOverlay={networkOverlay}
        />
      </div>

      {/* Draggable Property Detail Panel */}
      {selectedProperty && (
        <DraggablePanel
          title={selectedProperty.name}
          onClose={handleBackClick}
          storageKey="propertyDetail"
        >
          <div data-testid="selected-property">
            <PropertyCard property={selectedProperty} />
          </div>
        </DraggablePanel>
      )}
    </div>
  )
}
