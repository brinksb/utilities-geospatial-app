'use client'

import { useCallback, useMemo } from 'react'
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

interface PropertyMapProps {
  initialViewState?: ViewState
  tilesUrl?: string
  geoJsonOverlay?: FeatureCollection | null
  onPropertyClick?: (feature: Feature) => void
}

// Deck.gl overlay component that integrates with react-map-gl
function DeckGLOverlay(props: MapboxOverlayProps) {
  const overlay = useControl(() => new MapboxOverlay(props))
  overlay.setProps(props)
  return null
}

// Helper to convert hex color to RGB array
function hexToRgb(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
      200,
    ]
  }
  return [59, 130, 246, 200] // Default blue
}

export function PropertyMap({
  initialViewState = {
    longitude: -98.5795,  // Center of USA
    latitude: 39.8283,
    zoom: 4,
  },
  tilesUrl = '/tiles/properties_mvt/{z}/{x}/{y}',
  geoJsonOverlay = null,
  onPropertyClick,
}: PropertyMapProps) {

  // Create Deck.gl layers
  const layers = useMemo(() => {
    const result = []

    // MVT layer for properties from Martin
    result.push(
      new MVTLayer({
        id: 'properties-mvt',
        data: tilesUrl,
        minZoom: 0,
        maxZoom: 22,
        pointType: 'circle',
        getFillColor: (feature: Feature) => {
          // Use property_color from tile data or default
          const color = feature.properties?.property_color || '#3B82F6'
          return hexToRgb(color)
        },
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        getPointRadius: 8,
        pointRadiusMinPixels: 6,
        pointRadiusMaxPixels: 24,
        lineWidthMinPixels: 1,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 200, 0, 200],
        onClick: (info: { object?: Feature }) => {
          if (info.object && onPropertyClick) {
            onPropertyClick(info.object)
          }
        },
      })
    )

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
  }, [tilesUrl, geoJsonOverlay, onPropertyClick])

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
