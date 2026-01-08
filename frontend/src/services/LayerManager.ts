/**
 * LayerManager - Config-driven layer state management
 *
 * Manages layer visibility, persistence, and observer notifications.
 * Supports both flat and grouped layer configurations.
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
  type: 'mvt' | 'geojson' | 'group'
  url?: string
  visible: boolean
  style: LayerStyle
  // Group support
  expanded?: boolean
  children?: LayerConfig[]
}

export interface LayerPreset {
  id: string
  name: string
  layers: string[]
}

type LayerObserver = (layers: LayerConfig[]) => void

const STORAGE_KEY = 'layerVisibility'
const GROUP_EXPANDED_KEY = 'layerGroupExpanded'

export class LayerManager {
  private layers: LayerConfig[]
  private presets: LayerPreset[]
  private activePresetId: string | null = null
  private groupExpanded: Map<string, boolean> = new Map()
  private observers: Set<LayerObserver> = new Set()

  constructor(config: LayerConfig[], presets: LayerPreset[] = []) {
    // Deep copy config to avoid mutation
    this.layers = this.deepCopyLayers(config)
    this.presets = [...presets]

    // Initialize group expanded state from config
    this.initGroupExpanded()

    // Restore state from localStorage if available
    this.restoreVisibility()
    this.restoreGroupExpanded()
  }

  private deepCopyLayers(layers: LayerConfig[]): LayerConfig[] {
    return layers.map(layer => ({
      ...layer,
      style: { ...layer.style },
      children: layer.children ? this.deepCopyLayers(layer.children) : undefined,
    }))
  }

  private initGroupExpanded(): void {
    for (const layer of this.layers) {
      if (layer.type === 'group') {
        this.groupExpanded.set(layer.id, layer.expanded ?? true)
      }
    }
  }

  /**
   * Get all top-level layers (including groups)
   */
  getLayers(): LayerConfig[] {
    return this.deepCopyLayers(this.layers)
  }

  /**
   * Get all non-group layers flattened (for rendering)
   */
  getAllFlatLayers(): LayerConfig[] {
    const flat: LayerConfig[] = []
    const collect = (layers: LayerConfig[]) => {
      for (const layer of layers) {
        if (layer.type === 'group' && layer.children) {
          collect(layer.children)
        } else if (layer.type !== 'group') {
          flat.push({ ...layer, style: { ...layer.style } })
        }
      }
    }
    collect(this.layers)
    return flat
  }

  /**
   * Get a single layer by ID (searches nested layers too)
   */
  getLayer(id: string): LayerConfig | undefined {
    const find = (layers: LayerConfig[]): LayerConfig | undefined => {
      for (const layer of layers) {
        if (layer.id === id) {
          return { ...layer, style: { ...layer.style } }
        }
        if (layer.children) {
          const found = find(layer.children)
          if (found) return found
        }
      }
      return undefined
    }
    return find(this.layers)
  }

  /**
   * Get only visible non-group layers (for rendering)
   */
  getVisibleLayers(): LayerConfig[] {
    return this.getAllFlatLayers().filter(layer => layer.visible)
  }

  /**
   * Get top-level groups
   */
  getGroups(): LayerConfig[] {
    return this.layers
      .filter(layer => layer.type === 'group')
      .map(layer => ({ ...layer, style: { ...layer.style } }))
  }

  /**
   * Get children of a group
   */
  getGroupChildren(groupId: string): LayerConfig[] {
    const group = this.layers.find(l => l.id === groupId && l.type === 'group')
    if (!group?.children) return []
    return group.children.map(layer => ({ ...layer, style: { ...layer.style } }))
  }

  /**
   * Check if a group is expanded
   */
  isGroupExpanded(groupId: string): boolean {
    return this.groupExpanded.get(groupId) ?? true
  }

  /**
   * Toggle group expanded state
   */
  toggleGroup(groupId: string): void {
    const current = this.groupExpanded.get(groupId) ?? true
    this.groupExpanded.set(groupId, !current)
    this.persistGroupExpanded()
    this.notifyObservers()
  }

  /**
   * Get all configured presets
   */
  getPresets(): LayerPreset[] {
    return [...this.presets]
  }

  /**
   * Get the currently active preset ID (null if manually modified)
   */
  getActivePreset(): string | null {
    return this.activePresetId
  }

  /**
   * Apply a preset - sets layer visibility according to preset config
   */
  applyPreset(presetId: string): void {
    const preset = this.presets.find(p => p.id === presetId)
    if (!preset) return

    const presetLayerIds = new Set(preset.layers)

    // Set visibility for all flat layers based on preset
    const apply = (layers: LayerConfig[]) => {
      for (const layer of layers) {
        if (layer.type !== 'group') {
          layer.visible = presetLayerIds.has(layer.id)
        }
        if (layer.children) {
          apply(layer.children)
        }
      }
    }
    apply(this.layers)

    this.activePresetId = presetId
    this.persistVisibility()
    this.notifyObservers()
  }

  /**
   * Toggle layer visibility (searches nested layers)
   */
  toggleVisibility(id: string): void {
    const toggle = (layers: LayerConfig[]): boolean => {
      for (const layer of layers) {
        if (layer.id === id) {
          layer.visible = !layer.visible
          return true
        }
        if (layer.children && toggle(layer.children)) {
          return true
        }
      }
      return false
    }
    if (toggle(this.layers)) {
      this.activePresetId = null  // Manual change clears active preset
      this.persistVisibility()
      this.notifyObservers()
    }
  }

  /**
   * Set layer visibility to specific value (searches nested layers)
   */
  setVisibility(id: string, visible: boolean): void {
    const set = (layers: LayerConfig[]): boolean => {
      for (const layer of layers) {
        if (layer.id === id) {
          layer.visible = visible
          return true
        }
        if (layer.children && set(layer.children)) {
          return true
        }
      }
      return false
    }
    if (set(this.layers)) {
      this.activePresetId = null  // Manual change clears active preset
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
   * Restore visibility state from localStorage (handles nested layers)
   */
  private restoreVisibility(): void {
    if (typeof localStorage === 'undefined') return

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const visibility = JSON.parse(saved) as Record<string, boolean>
        const apply = (layers: LayerConfig[]) => {
          for (const layer of layers) {
            if (layer.id in visibility) {
              layer.visible = visibility[layer.id]
            }
            if (layer.children) {
              apply(layer.children)
            }
          }
        }
        apply(this.layers)
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Persist visibility state to localStorage (handles nested layers)
   */
  private persistVisibility(): void {
    if (typeof localStorage === 'undefined') return

    try {
      const visibility: Record<string, boolean> = {}
      const collect = (layers: LayerConfig[]) => {
        for (const layer of layers) {
          visibility[layer.id] = layer.visible
          if (layer.children) {
            collect(layer.children)
          }
        }
      }
      collect(this.layers)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility))
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Restore group expanded state from localStorage
   */
  private restoreGroupExpanded(): void {
    if (typeof localStorage === 'undefined') return

    try {
      const saved = localStorage.getItem(GROUP_EXPANDED_KEY)
      if (saved) {
        const expanded = JSON.parse(saved) as Record<string, boolean>
        for (const [id, isExpanded] of Object.entries(expanded)) {
          this.groupExpanded.set(id, isExpanded)
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Persist group expanded state to localStorage
   */
  private persistGroupExpanded(): void {
    if (typeof localStorage === 'undefined') return

    try {
      const expanded: Record<string, boolean> = {}
      for (const [id, isExpanded] of this.groupExpanded.entries()) {
        expanded[id] = isExpanded
      }
      localStorage.setItem(GROUP_EXPANDED_KEY, JSON.stringify(expanded))
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
