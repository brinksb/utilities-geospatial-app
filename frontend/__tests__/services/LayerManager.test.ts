import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LayerManager, LayerConfig } from '@/services/LayerManager'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('LayerManager', () => {
  let layerManager: LayerManager

  const testConfig: LayerConfig[] = [
    {
      id: 'properties',
      name: 'Properties',
      type: 'mvt',
      url: '/tiles/properties_mvt/{z}/{x}/{y}',
      visible: true,
      style: {
        fillColor: '#3B82F6',
        lineColor: '#ffffff',
        lineWidth: 2,
        radius: 8,
      },
    },
    {
      id: 'network',
      name: 'Network Edges',
      type: 'geojson',
      visible: false,
      style: {
        lineColor: '#FF8C00',
        lineWidth: 3,
      },
    },
  ]

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    layerManager = new LayerManager(testConfig)
  })

  describe('initialization', () => {
    it('loads layer config on construction', () => {
      const layers = layerManager.getLayers()
      expect(layers).toHaveLength(2)
      expect(layers[0].id).toBe('properties')
      expect(layers[1].id).toBe('network')
    })

    it('preserves visibility from config', () => {
      const layers = layerManager.getLayers()
      expect(layers[0].visible).toBe(true)
      expect(layers[1].visible).toBe(false)
    })

    it('restores visibility from localStorage if available', () => {
      // Set up localStorage with saved state
      const savedState = JSON.stringify({ properties: false, network: true })
      localStorageMock.getItem.mockReturnValueOnce(savedState)

      const manager = new LayerManager(testConfig)
      const layers = manager.getLayers()

      expect(layers[0].visible).toBe(false)
      expect(layers[1].visible).toBe(true)
    })
  })

  describe('visibility toggle', () => {
    it('toggles layer visibility', () => {
      expect(layerManager.getLayer('network')?.visible).toBe(false)

      layerManager.toggleVisibility('network')

      expect(layerManager.getLayer('network')?.visible).toBe(true)
    })

    it('persists visibility changes to localStorage', () => {
      layerManager.toggleVisibility('network')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'layerVisibility',
        expect.stringContaining('"network":true')
      )
    })

    it('does nothing for unknown layer id', () => {
      const originalLayers = [...layerManager.getLayers()]
      layerManager.toggleVisibility('unknown-layer')
      expect(layerManager.getLayers()).toEqual(originalLayers)
    })
  })

  describe('setVisibility', () => {
    it('sets layer visibility to specific value', () => {
      layerManager.setVisibility('properties', false)
      expect(layerManager.getLayer('properties')?.visible).toBe(false)

      layerManager.setVisibility('properties', true)
      expect(layerManager.getLayer('properties')?.visible).toBe(true)
    })
  })

  describe('getVisibleLayers', () => {
    it('returns only visible layers', () => {
      const visible = layerManager.getVisibleLayers()
      expect(visible).toHaveLength(1)
      expect(visible[0].id).toBe('properties')
    })

    it('updates when visibility changes', () => {
      layerManager.toggleVisibility('network')
      const visible = layerManager.getVisibleLayers()
      expect(visible).toHaveLength(2)
    })
  })

  describe('observer pattern', () => {
    it('notifies observers when layer visibility changes', () => {
      const observer = vi.fn()
      layerManager.subscribe(observer)

      layerManager.toggleVisibility('network')

      expect(observer).toHaveBeenCalledTimes(1)
      expect(observer).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: 'network', visible: true }),
      ]))
    })

    it('allows unsubscribing', () => {
      const observer = vi.fn()
      const unsubscribe = layerManager.subscribe(observer)

      unsubscribe()
      layerManager.toggleVisibility('network')

      expect(observer).not.toHaveBeenCalled()
    })

    it('supports multiple observers', () => {
      const observer1 = vi.fn()
      const observer2 = vi.fn()

      layerManager.subscribe(observer1)
      layerManager.subscribe(observer2)

      layerManager.toggleVisibility('network')

      expect(observer1).toHaveBeenCalledTimes(1)
      expect(observer2).toHaveBeenCalledTimes(1)
    })
  })

  describe('getLayer', () => {
    it('returns layer by id', () => {
      const layer = layerManager.getLayer('properties')
      expect(layer).toBeDefined()
      expect(layer?.name).toBe('Properties')
    })

    it('returns undefined for unknown id', () => {
      const layer = layerManager.getLayer('unknown')
      expect(layer).toBeUndefined()
    })
  })

  describe('layer style access', () => {
    it('provides access to layer style properties', () => {
      const layer = layerManager.getLayer('properties')
      expect(layer?.style.fillColor).toBe('#3B82F6')
      expect(layer?.style.radius).toBe(8)
    })
  })
})

// Group functionality tests
describe('LayerManager - Groups', () => {
  let layerManager: LayerManager

  const groupedConfig: LayerConfig[] = [
    {
      id: 'base-layers',
      name: 'Base Layers',
      type: 'group',
      visible: true,
      expanded: true,
      style: {},
      children: [
        {
          id: 'properties',
          name: 'Properties',
          type: 'mvt',
          url: '/tiles/properties_mvt/{z}/{x}/{y}',
          visible: true,
          style: { fillColor: '#3B82F6', radius: 8 },
        },
      ],
    },
    {
      id: 'analysis',
      name: 'Analysis',
      type: 'group',
      visible: true,
      expanded: false,
      style: {},
      children: [
        {
          id: 'network',
          name: 'Network Edges',
          type: 'geojson',
          visible: false,
          style: { lineColor: '#FF8C00', lineWidth: 3 },
        },
      ],
    },
  ]

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    layerManager = new LayerManager(groupedConfig)
  })

  describe('flat layer access', () => {
    it('getAllFlatLayers returns all layers including children', () => {
      const flat = layerManager.getAllFlatLayers()
      expect(flat).toHaveLength(2)
      expect(flat.map(l => l.id)).toEqual(['properties', 'network'])
    })

    it('getLayer finds child layers by id', () => {
      const layer = layerManager.getLayer('properties')
      expect(layer).toBeDefined()
      expect(layer?.name).toBe('Properties')
    })

    it('getVisibleLayers returns only visible child layers', () => {
      const visible = layerManager.getVisibleLayers()
      expect(visible).toHaveLength(1)
      expect(visible[0].id).toBe('properties')
    })
  })

  describe('group state', () => {
    it('tracks group expanded state', () => {
      expect(layerManager.isGroupExpanded('base-layers')).toBe(true)
      expect(layerManager.isGroupExpanded('analysis')).toBe(false)
    })

    it('toggleGroup expands collapsed group', () => {
      layerManager.toggleGroup('analysis')
      expect(layerManager.isGroupExpanded('analysis')).toBe(true)
    })

    it('toggleGroup collapses expanded group', () => {
      layerManager.toggleGroup('base-layers')
      expect(layerManager.isGroupExpanded('base-layers')).toBe(false)
    })

    it('persists group expanded state to localStorage', () => {
      layerManager.toggleGroup('analysis')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'layerGroupExpanded',
        expect.stringContaining('"analysis":true')
      )
    })

    it('restores group expanded state from localStorage', () => {
      const savedState = JSON.stringify({ 'base-layers': false, analysis: true })
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'layerGroupExpanded') return savedState
        return null
      })

      const manager = new LayerManager(groupedConfig)
      expect(manager.isGroupExpanded('base-layers')).toBe(false)
      expect(manager.isGroupExpanded('analysis')).toBe(true)
    })
  })

  describe('group structure', () => {
    it('getGroups returns top-level groups', () => {
      const groups = layerManager.getGroups()
      expect(groups).toHaveLength(2)
      expect(groups.map(g => g.id)).toEqual(['base-layers', 'analysis'])
    })

    it('getGroupChildren returns children of a group', () => {
      const children = layerManager.getGroupChildren('base-layers')
      expect(children).toHaveLength(1)
      expect(children[0].id).toBe('properties')
    })
  })

  describe('toggling child layers', () => {
    it('toggling child layer does not affect group state', () => {
      const wasExpanded = layerManager.isGroupExpanded('base-layers')
      layerManager.toggleVisibility('properties')
      expect(layerManager.isGroupExpanded('base-layers')).toBe(wasExpanded)
    })

    it('notifies observers when child visibility changes', () => {
      const observer = vi.fn()
      layerManager.subscribe(observer)
      layerManager.toggleVisibility('network')
      expect(observer).toHaveBeenCalled()
    })
  })
})

// Preset functionality tests
describe('LayerManager - Presets', () => {
  let layerManager: LayerManager

  const configWithPresets = {
    layers: [
      {
        id: 'base-layers',
        name: 'Base Layers',
        type: 'group' as const,
        visible: true,
        expanded: true,
        style: {},
        children: [
          {
            id: 'properties',
            name: 'Properties',
            type: 'mvt' as const,
            visible: true,
            style: { fillColor: '#3B82F6' },
          },
        ],
      },
      {
        id: 'analysis',
        name: 'Analysis',
        type: 'group' as const,
        visible: true,
        expanded: false,
        style: {},
        children: [
          {
            id: 'network',
            name: 'Network Edges',
            type: 'geojson' as const,
            visible: false,
            style: { lineColor: '#FF8C00' },
          },
        ],
      },
    ],
    presets: [
      { id: 'default', name: 'Default', layers: ['properties'] },
      { id: 'network-view', name: 'Network View', layers: ['properties', 'network'] },
      { id: 'minimal', name: 'Minimal', layers: [] },
    ],
  }

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    layerManager = new LayerManager(configWithPresets.layers, configWithPresets.presets)
  })

  describe('getPresets', () => {
    it('returns all configured presets', () => {
      const presets = layerManager.getPresets()
      expect(presets).toHaveLength(3)
      expect(presets.map(p => p.id)).toEqual(['default', 'network-view', 'minimal'])
    })

    it('returns empty array when no presets configured', () => {
      const managerWithoutPresets = new LayerManager(configWithPresets.layers)
      expect(managerWithoutPresets.getPresets()).toEqual([])
    })
  })

  describe('applyPreset', () => {
    it('sets correct layer visibility for preset', () => {
      layerManager.applyPreset('network-view')
      expect(layerManager.getLayer('properties')?.visible).toBe(true)
      expect(layerManager.getLayer('network')?.visible).toBe(true)
    })

    it('hides layers not in preset', () => {
      // First enable all
      layerManager.setVisibility('network', true)
      expect(layerManager.getLayer('network')?.visible).toBe(true)

      // Apply minimal preset (no layers)
      layerManager.applyPreset('minimal')
      expect(layerManager.getLayer('properties')?.visible).toBe(false)
      expect(layerManager.getLayer('network')?.visible).toBe(false)
    })

    it('persists visibility changes to localStorage', () => {
      layerManager.applyPreset('network-view')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'layerVisibility',
        expect.any(String)
      )
    })

    it('notifies observers when preset applied', () => {
      const observer = vi.fn()
      layerManager.subscribe(observer)
      layerManager.applyPreset('default')
      expect(observer).toHaveBeenCalled()
    })

    it('does nothing for unknown preset id', () => {
      const before = layerManager.getVisibleLayers().map(l => l.id)
      layerManager.applyPreset('unknown-preset')
      const after = layerManager.getVisibleLayers().map(l => l.id)
      expect(before).toEqual(after)
    })
  })

  describe('getActivePreset', () => {
    it('returns active preset id after applying', () => {
      layerManager.applyPreset('network-view')
      expect(layerManager.getActivePreset()).toBe('network-view')
    })

    it('returns null when visibility manually changed', () => {
      layerManager.applyPreset('default')
      layerManager.toggleVisibility('network')
      expect(layerManager.getActivePreset()).toBeNull()
    })
  })
})
