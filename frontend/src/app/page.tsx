'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { PropertyMap } from '@/components/PropertyMap'
import { PipeInspector } from '@/components/PipeInspector'
import { StatsPanel } from '@/components/StatsPanel'
import { LayerManager, LayerConfig, LayerPreset } from '@/services/LayerManager'
import { LegendService } from '@/services/LegendService'
import { Legend } from '@/components/Legend'
import { showToast } from '@/utils/toast'
import layersConfig from '@/config/layers.json'
import type { FeatureCollection, Feature } from 'geojson'

// Outage stats from the API
interface OutageStats {
  affected_building_count: number
  affected_service_count: number
  total_service_length_m: number
}

// LegendService doesn't use localStorage, safe to initialize at module level
const legendService = new LegendService()

// Simulation modes for Sector 7G
type SimulationMode = 'explore' | 'outage' | 'spread'

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
  const [outageOverlay, setOutageOverlay] = useState<FeatureCollection | null>(null)
  const [outageStats, setOutageStats] = useState<OutageStats | null>(null)
  const [spreadOverlay, setSpreadOverlay] = useState<FeatureCollection | null>(null)
  const [currentHop, setCurrentHop] = useState<number>(0)
  const [maxHop, setMaxHop] = useState<number>(0)
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('explore')
  const [selectedPipe, setSelectedPipe] = useState<any | null>(null)
  const [statsCollapsed, setStatsCollapsed] = useState(false)
  const [, forceUpdate] = useState(0)
  const [isClient, setIsClient] = useState(false)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [loadingWorstDay, setLoadingWorstDay] = useState(false)
  const animationRef = useRef<NodeJS.Timeout | null>(null)

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

  // Clear any running animation
  const clearAnimation = useCallback(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current)
      animationRef.current = null
    }
  }, [])

  // Clear all overlays
  const clearOverlays = useCallback(() => {
    clearAnimation()
    setNetworkOverlay(null)
    setOutageOverlay(null)
    setOutageStats(null)
    setSpreadOverlay(null)
    setSelectedPipe(null)
    setCurrentHop(0)
    setMaxHop(0)
  }, [clearAnimation])

  /**
   * Fetch network overlay for given coordinates (Explore mode).
   */
  const fetchNetworkOverlay = async (lon: number, lat: number) => {
    clearOverlays()
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
            showToast.network(network.features?.length || 0)
            return
          }
        }
      }
      showToast.error('No network found at this location')
    } catch (err) {
      console.error('Error fetching network overlay:', err)
      showToast.error('Failed to trace network')
    }
  }

  /**
   * Fetch outage impact for an edge (Break mode).
   * "Sector 7G Outage Simulator" - Shows affected buildings when Homer breaks a pipe.
   */
  const fetchOutageImpact = async (lon: number, lat: number) => {
    clearOverlays()
    try {
      // First find the nearest edge
      const nearestRes = await fetch(`/api/graph/nearest_edge?lon=${lon}&lat=${lat}`)
      if (nearestRes.ok) {
        const nearest = await nearestRes.json()
        const edgeId = nearest.properties?.edge_id
        if (edgeId) {
          // Get affected buildings
          const outageRes = await fetch(`/api/graph/outage/${edgeId}`)
          if (outageRes.ok) {
            const outage = await outageRes.json()
            setOutageOverlay(outage)
            // Store stats for display
            if (outage.stats) {
              setOutageStats(outage.stats)
              showToast.outage(outage.stats.affected_building_count)
            }
            // Also show the broken pipe
            setNetworkOverlay({
              type: 'FeatureCollection',
              features: [nearest]
            })
            return
          }
        }
      }
      showToast.error('No pipe found at this location')
    } catch (err) {
      console.error('Error fetching outage impact:', err)
      showToast.error('Failed to simulate outage')
    }
  }

  /**
   * Fetch Homer's Worst Day - the single most critical pipe.
   * One-click demo to show maximum outage impact.
   */
  const fetchWorstDay = async () => {
    setLoadingWorstDay(true)
    clearOverlays()
    try {
      const res = await fetch('/api/graph/worst_day')
      if (res.ok) {
        const data = await res.json()
        setOutageOverlay(data)
        if (data.stats) {
          setOutageStats(data.stats)
        }
        // Show the worst pipe highlighted
        if (data.worst_pipe?.geometry) {
          setNetworkOverlay({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: data.worst_pipe.geometry,
              properties: { edge_id: data.worst_pipe.edge_id }
            }]
          })
        }
        // Show dramatic toast
        if (data.dramatic_message) {
          showToast.worstDay(data.stats?.affected_building_count || 0, data.dramatic_message)
        }
        // Switch to outage mode to show the stats panel
        setSimulationMode('outage')
      } else {
        showToast.error('Failed to find worst day scenario')
      }
    } catch (err) {
      console.error('Error fetching worst day:', err)
      showToast.error('Failed to simulate worst day')
    } finally {
      setLoadingWorstDay(false)
    }
  }

  /**
   * Fetch spread simulation and animate it (Spread mode).
   * "Nuclear Plant Blast Radius" - Animated contamination spread.
   */
  const fetchSpreadSimulation = async (lon: number, lat: number) => {
    clearOverlays()
    try {
      const spreadRes = await fetch(`/api/graph/spread?lon=${lon}&lat=${lat}&max_hops=8`)
      if (spreadRes.ok) {
        const spread = await spreadRes.json()
        setSpreadOverlay(spread)

        // Find max hop for animation
        const hops = spread.features.map((f: Feature) => f.properties?.hop || 0)
        const maxHopValue = Math.max(...hops, 0)
        setMaxHop(maxHopValue)
        setCurrentHop(0)

        showToast.spread(maxHopValue, spread.features?.length || 0)

        // Animate through hops
        let hop = 0
        animationRef.current = setInterval(() => {
          hop++
          if (hop > maxHopValue) {
            // Loop the animation
            hop = 0
          }
          setCurrentHop(hop)
        }, 400)
      } else {
        showToast.error('No network found at this location')
      }
    } catch (err) {
      console.error('Error fetching spread simulation:', err)
      showToast.error('Failed to simulate spread')
    }
  }

  /**
   * Handle feature click from map - behavior depends on simulation mode.
   */
  const handleMapFeatureClick = async (feature: any) => {
    // Check if this is a pipe (has pipe-specific properties from MVT tile)
    const props = feature.properties
    if (simulationMode === 'explore' && props?.material && props?.diameter_mm) {
      // This is a pipe feature - show the inspector
      setSelectedPipe(props)
      showToast.pipeSelected(props.id, props.class)
      return
    }

    // Get coordinates from feature
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

      // Execute based on current mode
      switch (simulationMode) {
        case 'outage':
          await fetchOutageImpact(lon, lat)
          break
        case 'spread':
          await fetchSpreadSimulation(lon, lat)
          break
        default:
          await fetchNetworkOverlay(lon, lat)
      }
    }
  }

  // Cleanup animation on unmount
  useEffect(() => {
    return () => clearAnimation()
  }, [clearAnimation])

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

            {/* Simulation Mode Selector */}
            <div
              data-testid="simulation-modes"
              style={{
                marginBottom: '12px',
                paddingBottom: '12px',
                borderBottom: '2px dashed #FED90F',
              }}
            >
              <h3 style={{
                margin: '0 0 8px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#666',
              }}>
                Simulation Mode
              </h3>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  data-testid="mode-explore"
                  onClick={() => { setSimulationMode('explore'); clearOverlays(); }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    border: '2px solid #000',
                    backgroundColor: simulationMode === 'explore' ? '#FED90F' : '#fff',
                    color: '#000',
                    cursor: 'pointer',
                    boxShadow: simulationMode === 'explore' ? 'none' : '2px 2px 0 #000',
                    transform: simulationMode === 'explore' ? 'translate(2px, 2px)' : 'none',
                  }}
                >
                  🔍 Explore
                </button>
                <button
                  data-testid="mode-outage"
                  onClick={() => { setSimulationMode('outage'); clearOverlays(); }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    border: '2px solid #000',
                    backgroundColor: simulationMode === 'outage' ? '#FF6347' : '#fff',
                    color: simulationMode === 'outage' ? '#fff' : '#000',
                    cursor: 'pointer',
                    boxShadow: simulationMode === 'outage' ? 'none' : '2px 2px 0 #000',
                    transform: simulationMode === 'outage' ? 'translate(2px, 2px)' : 'none',
                  }}
                >
                  💥 Break Pipe
                </button>
                <button
                  data-testid="mode-spread"
                  onClick={() => { setSimulationMode('spread'); clearOverlays(); }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    border: '2px solid #000',
                    backgroundColor: simulationMode === 'spread' ? '#32CD32' : '#fff',
                    color: simulationMode === 'spread' ? '#fff' : '#000',
                    cursor: 'pointer',
                    boxShadow: simulationMode === 'spread' ? 'none' : '2px 2px 0 #000',
                    transform: simulationMode === 'spread' ? 'translate(2px, 2px)' : 'none',
                  }}
                >
                  ☢️ Spread
                </button>
              </div>
              {simulationMode === 'outage' && (
                <div style={{ marginTop: '8px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '10px', color: '#FF6347' }}>
                    Click a pipe to simulate breaking it. Shows affected buildings.
                  </p>
                  {outageStats && (
                    <div
                      data-testid="outage-stats"
                      style={{
                        padding: '10px',
                        backgroundColor: '#FFE4E1',
                        borderRadius: '6px',
                        border: '2px solid #FF6347',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#8B0000' }}>
                        D'oh! Impact Summary:
                      </div>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Buildings affected:</span>
                          <strong>{outageStats.affected_building_count}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Service connections:</span>
                          <strong>{outageStats.affected_service_count}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Service line length:</span>
                          <strong>{outageStats.total_service_length_m.toFixed(0)}m</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {simulationMode === 'spread' && (
                <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#32CD32' }}>
                  Click anywhere to start a spread animation through the network.
                  {maxHop > 0 && ` Wave: ${currentHop}/${maxHop}`}
                </p>
              )}

              {/* Homer's Worst Day Button */}
              <button
                data-testid="btn-worst-day"
                onClick={fetchWorstDay}
                disabled={loadingWorstDay}
                style={{
                  marginTop: '12px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  border: '3px solid #8B0000',
                  backgroundColor: loadingWorstDay ? '#ccc' : '#FF6347',
                  color: '#fff',
                  cursor: loadingWorstDay ? 'wait' : 'pointer',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '2px 2px 0 #8B0000',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>☢️</span>
                {loadingWorstDay ? 'Finding...' : "Homer's Worst Day"}
                <span>🍩</span>
              </button>
              <p style={{ margin: '4px 0 0', fontSize: '9px', color: '#999', textAlign: 'center' }}>
                Find the single most catastrophic pipe to break
              </p>
            </div>

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

          {/* Network Statistics Panel */}
          <StatsPanel
            collapsed={statsCollapsed}
            onToggle={() => setStatsCollapsed(!statsCollapsed)}
          />
        </div>
      </div>

      {/* Map */}
      <div data-testid="map-container" style={{ flex: 1 }}>
        <PropertyMap
          visibleLayers={layerManager.getVisibleLayers()}
          onPropertyClick={handleMapFeatureClick}
          geoJsonOverlay={networkOverlay}
          outageOverlay={outageOverlay}
          spreadOverlay={spreadOverlay}
          currentHop={currentHop}
        />
      </div>

      {/* Pipe Inspector Panel */}
      {selectedPipe && (
        <PipeInspector
          pipe={selectedPipe}
          onClose={() => setSelectedPipe(null)}
        />
      )}
    </div>
  )
}
