/**
 * LegendService - Generates legend items from layer configurations
 *
 * Supports:
 * - Simple single-color legends (from fillColor/lineColor)
 * - Categorical legends (from categorical config with property/colors map)
 */

import { LayerConfig } from './LayerManager'

export interface LegendItem {
  label: string
  color: string
}

// Extended layer config with categorical support
export interface LayerConfigWithCategorical extends LayerConfig {
  categorical?: {
    property: string
    colors: Record<string, string>
  }
}

export class LegendService {
  /**
   * Generate legend items for a single layer
   */
  getLegendForLayer(layer: LayerConfigWithCategorical): LegendItem[] {
    // Check for categorical styling first
    if (layer.categorical?.colors) {
      return Object.entries(layer.categorical.colors).map(([label, color]) => ({
        label,
        color,
      }))
    }

    // Fall back to simple color from style
    const color = layer.style.fillColor || layer.style.lineColor
    if (color) {
      return [{ label: layer.name, color }]
    }

    return []
  }

  /**
   * Generate legends for all visible layers
   * Returns a map of layerId -> LegendItem[]
   */
  getLegendForVisibleLayers(
    layers: LayerConfigWithCategorical[]
  ): Record<string, LegendItem[]> {
    const result: Record<string, LegendItem[]> = {}

    for (const layer of layers) {
      if (!layer.visible) continue

      const items = this.getLegendForLayer(layer)
      if (items.length > 0) {
        result[layer.id] = items
      }
    }

    return result
  }
}
