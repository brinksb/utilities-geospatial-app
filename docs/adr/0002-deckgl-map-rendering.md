# ADR 0002: Deck.gl for Map Rendering

## Status
Accepted

## Context
We needed a map rendering solution for displaying property data as interactive points on a map. Options considered:

1. **MapLibre GL JS alone** - Lightweight, native MVT support
2. **Deck.gl + MapLibre** - Advanced rendering, WebGL layers on MapLibre basemap
3. **Leaflet** - Simpler but less performant for large datasets

Key requirements:
- Render MVT tiles from Martin
- Interactive click handlers on features
- Support for future GeoJSON overlays (e.g., pgrouting results)
- Good performance with many features

## Decision
We chose **Deck.gl with MapLibre GL as basemap** because:

1. **MVTLayer**: Native support for Mapbox Vector Tiles with automatic tile management
2. **GeoJsonLayer**: Ready for future dynamic overlays from API (computed routes, analysis results)
3. **Picking**: Built-in feature picking with `pickable: true` and `onClick` handlers
4. **Future-proof**: Supports 3D rendering, heatmaps, and advanced visualizations if needed

## Consequences

### Positive
- `MVTLayer` handles tile loading, caching, and rendering automatically
- `GeoJsonLayer` already scaffolded for future dynamic geometry overlays
- Color-coded features using `getFillColor` with property type colors from tiles
- Auto-highlight on hover with `autoHighlight: true`

### Negative
- WebGL dependency makes unit testing harder (requires extensive mocking)
- Larger bundle size than MapLibre alone
- Steeper learning curve

### Implementation
```typescript
// frontend/src/components/PropertyMap.tsx
new MVTLayer({
  data: '/tiles/properties_mvt/{z}/{x}/{y}',
  getFillColor: (feature) => hexToRgb(feature.properties?.property_color),
  pickable: true,
  onClick: (info) => onPropertyClick?.(info.object)
})
```

The `geoJsonOverlay` prop is ready for future use:
```typescript
if (geoJsonOverlay) {
  result.push(new GeoJsonLayer({ id: 'geojson-overlay', data: geoJsonOverlay }))
}
```
