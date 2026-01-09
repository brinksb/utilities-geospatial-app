'use client'

import { useState, useEffect, useMemo } from 'react'
import { PropertyMap } from '@/components/PropertyMap'
import { LayerManager, LayerConfig, LayerPreset } from '@/services/LayerManager'
import { LegendService } from '@/services/LegendService'
import { Legend } from '@/components/Legend'
import layersConfig from '@/config/layers.json'
import type { FeatureCollection } from 'geojson'

// LegendService doesn't use localStorage, safe to initialize at module level
const legendService = new LegendService()

// Simpsons-style quotes that rotate
const QUOTES = [
  "Mmm... infrastructure",
  "D'oh! A leak in Sector 7G",
  "Excellent... the grid is stable",
  "Thank you, come again!",
  "Everything's coming up Milhouse!",
]

export default function Home() {
  const [networkOverlay, setNetworkOverlay] = useState<FeatureCollection | null>(null)
  const [, forceUpdate] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)

  // Initialize LayerManager only on client side to avoid hydration mismatch
  const layerManager = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new LayerManager(
      layersConfig.layers as LayerConfig[],
      layersConfig.presets as LayerPreset[]
    )
  }, [])

  // Mark as client-side after mount
  useEffect(() => {
    setIsClient(true)
    // Rotate quotes every 8 seconds
    const interval = setInterval(() => {
      setQuoteIndex(i => (i + 1) % QUOTES.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  // Subscribe to layer changes
  useEffect(() => {
    if (!layerManager) return
    const unsubscribe = layerManager.subscribe(() => {
      forceUpdate(n => n + 1)
    })
    return unsubscribe
  }, [layerManager])

  /**
   * Fetch network overlay for given coordinates.
   * Demo feature: shows nearby network edges when clicking on the map.
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
   * Handle feature click from map (building or network element).
   */
  const handleMapFeatureClick = async (feature: any) => {
    // Get coordinates from feature for network overlay
    const coords = feature.geometry?.coordinates
    if (coords) {
      // Handle different geometry types
      let lon: number, lat: number
      if (Array.isArray(coords[0])) {
        // Polygon or LineString - use centroid approximation
        const flat = coords.flat(Infinity) as number[]
        lon = flat.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / (flat.length / 2)
        lat = flat.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0) / (flat.length / 2)
      } else {
        // Point
        [lon, lat] = coords
      }
      await fetchNetworkOverlay(lon, lat)
    }
  }

  // Simpsons sky gradient background for header
  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #87CEEB 0%, #87CEEB 60%, #fff 100%)',
    padding: '16px',
    borderBottom: '4px solid #FED90F',
    position: 'relative',
    overflow: 'hidden',
  }

  // Cloud decoration
  const CloudDecor = () => (
    <div style={{ position: 'absolute', top: '8px', right: '16px', opacity: 0.6 }}>
      <svg width="60" height="30" viewBox="0 0 60 30">
        <ellipse cx="20" cy="20" rx="15" ry="10" fill="white"/>
        <ellipse cx="35" cy="18" rx="18" ry="12" fill="white"/>
        <ellipse cx="50" cy="20" rx="12" ry="8" fill="white"/>
      </svg>
    </div>
  )

  // Pink donut icon (Homer's favorite)
  const DonutIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
      <circle cx="12" cy="12" r="10" fill="#FF69B4" stroke="#8B4513" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill="#FFF8DC"/>
      <circle cx="8" cy="8" r="1.5" fill="#FF1493"/>
      <circle cx="15" cy="9" r="1.5" fill="#FF1493"/>
      <circle cx="14" cy="14" r="1.5" fill="#FF1493"/>
      <circle cx="9" cy="15" r="1.5" fill="#FF1493"/>
    </svg>
  )

  // Show loading state until client-side initialization is complete
  if (!isClient || !layerManager) {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        <div
          data-testid="sidebar"
          style={{
            width: '340px',
            borderRight: '3px solid #FED90F',
            overflow: 'auto',
            backgroundColor: '#87CEEB',
          }}
        >
          <div style={headerStyle}>
            <CloudDecor />
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontFamily: 'Impact, Haettenschweiler, sans-serif',
              color: '#FED90F',
              textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
              letterSpacing: '1px',
            }}>
              SPRINGFIELD
            </h1>
            <p style={{
              margin: '4px 0 0',
              fontSize: '14px',
              fontFamily: 'Impact, sans-serif',
              color: '#000',
              letterSpacing: '2px',
            }}>
              UTILITIES DEPT.
            </p>
          </div>
          <div style={{ padding: '16px' }}>
            <div data-testid="layer-controls" style={{ padding: '12px', backgroundColor: '#fff', borderRadius: '8px', border: '2px solid #FED90F' }}>
              <p style={{ color: '#6b7280', display: 'flex', alignItems: 'center' }}>
                <DonutIcon /> Loading...
              </p>
            </div>
          </div>
        </div>
        <div data-testid="map-container" style={{ flex: 1 }}>
          <PropertyMap
            onPropertyClick={handleMapFeatureClick}
            geoJsonOverlay={networkOverlay}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <div
        data-testid="sidebar"
        style={{
          width: '340px',
          borderRight: '3px solid #FED90F',
          overflow: 'auto',
          backgroundColor: '#f0f9ff',
        }}
      >
        {/* Simpsons-style Header */}
        <div style={headerStyle}>
          <CloudDecor />
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontFamily: 'Impact, Haettenschweiler, sans-serif',
            color: '#FED90F',
            textShadow: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
            letterSpacing: '1px',
          }}>
            SPRINGFIELD
          </h1>
          <p style={{
            margin: '4px 0 0',
            fontSize: '14px',
            fontFamily: 'Impact, sans-serif',
            color: '#000',
            letterSpacing: '2px',
          }}>
            UTILITIES DEPT.
          </p>
          <p style={{
            margin: '8px 0 0',
            fontSize: '11px',
            fontStyle: 'italic',
            color: '#333',
          }}>
            "{QUOTES[quoteIndex]}"
          </p>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Layer Controls */}
          <div
            data-testid="layer-controls"
            style={{
              padding: '12px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '2px solid #FED90F',
              boxShadow: '3px 3px 0 rgba(0,0,0,0.1)',
            }}
          >
            {/* Preset Buttons - Simpsons themed */}
            {layerManager.getPresets().length > 0 && (
              <div
                data-testid="layer-presets"
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px',
                  paddingBottom: '12px',
                  borderBottom: '2px dashed #FED90F',
                }}
              >
                {layerManager.getPresets().map((preset) => (
                  <button
                    key={preset.id}
                    data-testid={`preset-${preset.id}`}
                    onClick={() => layerManager.applyPreset(preset.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      borderRadius: '4px',
                      border: '2px solid #000',
                      backgroundColor: layerManager.getActivePreset() === preset.id ? '#FED90F' : '#fff',
                      color: '#000',
                      cursor: 'pointer',
                      boxShadow: layerManager.getActivePreset() === preset.id ? 'none' : '2px 2px 0 #000',
                      transform: layerManager.getActivePreset() === preset.id ? 'translate(2px, 2px)' : 'none',
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}

            <h2 style={{
              margin: '0 0 8px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
            }}>
              <span style={{ marginRight: '6px' }}>📋</span> Sector 7G Controls
            </h2>
            {layerManager.getGroups().map((group) => (
              <div key={group.id} style={{ marginBottom: '8px' }}>
                <div
                  data-testid={`layer-group-${group.id}`}
                  onClick={() => layerManager.toggleGroup(group.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '6px 8px',
                    fontWeight: 600,
                    backgroundColor: '#FFF8DC',
                    borderRadius: '4px',
                    border: '1px solid #DEB887',
                  }}
                >
                  <span style={{ marginRight: '8px', fontSize: '12px' }}>
                    {layerManager.isGroupExpanded(group.id) ? '▼' : '▶'}
                  </span>
                  {group.name}
                </div>
                {layerManager.isGroupExpanded(group.id) && (
                  <div style={{ marginLeft: '12px', marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #FED90F' }}>
                    {layerManager.getGroupChildren(group.id).map((layer) => (
                      <label
                        key={layer.id}
                        data-testid={`layer-toggle-${layer.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 0',
                          cursor: 'pointer',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={layer.visible}
                          onChange={() => layerManager.toggleVisibility(layer.id)}
                          style={{ marginRight: '8px', accentColor: '#FED90F' }}
                        />
                        {layer.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Legend for visible layers */}
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '2px dashed #FED90F' }}>
              {layerManager.getVisibleLayers().map((layer) => {
                const items = legendService.getLegendForLayer(layer)
                return items.length > 0 ? (
                  <Legend key={layer.id} title={layer.name} items={items} />
                ) : null
              })}
            </div>
          </div>

          {/* Fun Info Panel */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '2px solid #FF69B4',
              fontSize: '12px',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: '-12px', left: '12px', backgroundColor: '#fff', padding: '0 8px' }}>
              <span style={{ fontSize: '16px' }}>🏭</span>
            </div>
            <p style={{ margin: '4px 0 8px', fontWeight: 'bold', color: '#000' }}>
              Springfield, Oregon
            </p>
            <p style={{ margin: '0', color: '#666', lineHeight: 1.4 }}>
              Home of the Nuclear Power Plant, Kwik-E-Mart, and approximately
              19,759 buildings that definitely meet safety codes.*
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#999', fontStyle: 'italic' }}>
              *Safety codes not actually verified. Mr. Burns declined comment.
            </p>
          </div>

          {/* Easter egg tip */}
          <div
            style={{
              marginTop: '12px',
              padding: '10px',
              backgroundColor: '#FED90F',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#000',
              display: 'flex',
              alignItems: 'flex-start',
            }}
          >
            <DonutIcon />
            <div>
              <strong>Pro tip:</strong> Click any building to trace the utility network!
              Watch the pipes light up like Homer's eyes at an all-you-can-eat buffet.
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div data-testid="map-container" style={{ flex: 1 }}>
        <PropertyMap
          visibleLayers={layerManager.getVisibleLayers()}
          onPropertyClick={handleMapFeatureClick}
          geoJsonOverlay={networkOverlay}
        />
      </div>
    </div>
  )
}
