'use client'

import { useMemo } from 'react'
import Map, { NavigationControl, useControl } from 'react-map-gl/maplibre'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { MVTLayer } from '@deck.gl/geo-layers'
import { GeoJsonLayer } from '@deck.gl/layers'
import type { Feature, FeatureCollection } from 'geojson'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import 'maplibre-gl/dist/maplibre-gl.css'

const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

interface ViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch?: number
  bearing?: number
}

interface LayerStyle {
  fillColor?: string
  lineColor?: string
  lineWidth?: number
  opacity?: number
}

interface LayerConfig {
  id: string
  name: string
  type: string
  url?: string
  visible: boolean
  style?: LayerStyle
  pickable?: boolean
  autoHighlight?: boolean
  highlightColor?: string
  categorical?: {
    property: string
    colors: Record<string, string>
  }
}

interface PropertyMapProps {
  initialViewState?: ViewState
  visibleLayers?: LayerConfig[]
  geoJsonOverlay?: FeatureCollection | null
  onPropertyClick?: (feature: Feature) => void
}

// Deck.gl overlay component that integrates with react-map-gl
function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props))
  overlay.setProps(props)
  return null
}

// Helper to convert hex color to RGBA array
function hexToRgba(hex: string, opacity: number = 200): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      opacity,
    ]
  }
  return [59, 130, 246, opacity] // Default blue
}

// Default layers for Springfield Utilities
const DEFAULT_LAYERS: LayerConfig[] = [
  {
    id: 'buildings',
    name: 'Buildings',
    type: 'mvt',
    url: '/tiles/osm_buildings_mvt/{z}/{x}/{y}',
    visible: true,
    style: {
      fillColor: '#FED90F', // Simpsons yellow
      lineColor: '#D4A900',
      lineWidth: 1,
      opacity: 180,
    },
    pickable: true,
    autoHighlight: true,
    highlightColor: '#FF6B35',
  },
  {
    id: 'pipes',
    name: 'Utility Network',
    type: 'mvt',
    url: '/tiles/synth_pipes_mvt/{z}/{x}/{y}',
    visible: true,
    style: {
      lineColor: '#0078D4',
      lineWidth: 3,
      opacity: 220,
    },
    pickable: true,
    categorical: {
      property: 'class',
      colors: {
        main: '#0078D4',
        secondary: '#00A86B',
      },
    },
  },
  {
    id: 'services',
    name: 'Service Lines',
    type: 'mvt',
    url: '/tiles/synth_services_mvt/{z}/{x}/{y}',
    visible: false,
    style: {
      lineColor: '#888888',
      lineWidth: 1,
      opacity: 150,
    },
    pickable: false,
  },
]

export function PropertyMap({
  initialViewState = {
    longitude: -123.0,  // Springfield, Oregon (The Simpsons' inspiration)
    latitude: 44.055,
    zoom: 14,
  },
  visibleLayers,
  geoJsonOverlay = null,
  onPropertyClick,
}: PropertyMapProps) {

  // Use provided layers or defaults
  const layerConfigs = visibleLayers || DEFAULT_LAYERS

  // Create Deck.gl layers from config
  const layers = useMemo(() => {
    const result: any[] = []

    // Create MVT layers for each visible layer config
    layerConfigs.forEach((config) => {
      if (!config.visible || config.type !== 'mvt' || !config.url) return

      const style = config.style || {}
      const opacity = style.opacity || 200

      result.push(
        new MVTLayer({
          id: `mvt-${config.id}`,
          data: config.url,
          minZoom: 0,
          maxZoom: 22,
          getFillColor: (feature: Feature) => {
            // For categorical styling (like pipe classes)
            if (config.categorical) {
              const propValue = feature.properties?.[config.categorical.property]
              const color = config.categorical.colors[propValue]
              if (color) return hexToRgba(color, opacity)
            }
            return hexToRgba(style.fillColor || '#3B82F6', opacity)
          },
          getLineColor: (feature: Feature) => {
            // For categorical styling
            if (config.categorical) {
              const propValue = feature.properties?.[config.categorical.property]
              const color = config.categorical.colors[propValue]
              if (color) return hexToRgba(color, 255)
            }
            return hexToRgba(style.lineColor || '#FFFFFF', 255)
          },
          getLineWidth: style.lineWidth || 1,
          lineWidthMinPixels: 1,
          pickable: config.pickable ?? false,
          autoHighlight: config.autoHighlight ?? false,
          highlightColor: config.highlightColor ? hexToRgba(config.highlightColor, 200) : [255, 200, 0, 200],
          onClick: (info: { object?: Feature }) => {
            if (info.object && onPropertyClick) {
              onPropertyClick(info.object)
            }
          },
        })
      )
    })

    // GeoJSON overlay for dynamic data (routes, query results, etc.)
    if (geoJsonOverlay) {
      result.push(
        new GeoJsonLayer({
          id: 'geojson-overlay',
          data: geoJsonOverlay,
          getFillColor: [255, 140, 0, 100],
          getLineColor: [255, 140, 0, 255],
          getLineWidth: 3,
          getPointRadius: 10,
          pointRadiusMinPixels: 6,
          lineWidthMinPixels: 2,
          pickable: true,
        })
      )
    }

    return result
  }, [layerConfigs, geoJsonOverlay, onPropertyClick])

  return (
    <Map
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%' }}
      mapStyle={BASEMAP_STYLE}
    >
      <DeckGLOverlay layers={layers} />
      <NavigationControl position="top-right" />
    </Map>
  )
}
