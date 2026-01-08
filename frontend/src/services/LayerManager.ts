/**
 * LayerManager - Config-driven layer state management
 *
 * Manages layer visibility, persistence, and observer notifications.
 * Designed to work with Deck.gl layers (MVT, GeoJSON).
 */

export interface LayerStyle {
  fillColor?: string
  lineColor?: string
  lineWidth?: number
  radius?: number
  opacity?: number
}

export interface LayerConfig {
  id: string
  name: string
  type: 'mvt' | 'geojson'
  url?: string
  visible: boolean
  style: LayerStyle
}

type LayerObserver = (layers: LayerConfig[]) => void

const STORAGE_KEY = 'layerVisibility'

export class LayerManager {
  private layers: LayerConfig[]
  private observers: Set<LayerObserver> = new Set()

  constructor(config: LayerConfig[]) {
    // Deep copy config to avoid mutation
    this.layers = config.map(layer => ({ ...layer, style: { ...layer.style } }))

    // Restore visibility from localStorage if available
    this.restoreVisibility()
  }

  /**
   * Get all layers
   */
  getLayers(): LayerConfig[] {
    return this.layers.map(layer => ({ ...layer, style: { ...layer.style } }))
  }

  /**
   * Get a single layer by ID
   */
  getLayer(id: string): LayerConfig | undefined {
    const layer = this.layers.find(l => l.id === id)
    return layer ? { ...layer, style: { ...layer.style } } : undefined
  }

  /**
   * Get only visible layers
   */
  getVisibleLayers(): LayerConfig[] {
    return this.layers
      .filter(layer => layer.visible)
      .map(layer => ({ ...layer, style: { ...layer.style } }))
  }

  /**
   * Toggle layer visibility
   */
  toggleVisibility(id: string): void {
    const layer = this.layers.find(l => l.id === id)
    if (layer) {
      layer.visible = !layer.visible
      this.persistVisibility()
      this.notifyObservers()
    }
  }

  /**
   * Set layer visibility to specific value
   */
  setVisibility(id: string, visible: boolean): void {
    const layer = this.layers.find(l => l.id === id)
    if (layer) {
      layer.visible = visible
      this.persistVisibility()
      this.notifyObservers()
    }
  }

  /**
   * Subscribe to layer changes
   * Returns unsubscribe function
   */
  subscribe(observer: LayerObserver): () => void {
    this.observers.add(observer)
    return () => {
      this.observers.delete(observer)
    }
  }

  /**
   * Restore visibility state from localStorage
   */
  private restoreVisibility(): void {
    if (typeof localStorage === 'undefined') return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const visibility = JSON.parse(saved) as Record<string, boolean>
        this.layers.forEach(layer => {
          if (layer.id in visibility) {
            layer.visible = visibility[layer.id]
          }
        })
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Persist visibility state to localStorage
   */
  private persistVisibility(): void {
    if (typeof localStorage === 'undefined') return

    try {
      const visibility: Record<string, boolean> = {}
      this.layers.forEach(layer => {
        visibility[layer.id] = layer.visible
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility))
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Notify all observers of layer changes
   */
  private notifyObservers(): void {
    const layers = this.getLayers()
    this.observers.forEach(observer => observer(layers))
  }
}
