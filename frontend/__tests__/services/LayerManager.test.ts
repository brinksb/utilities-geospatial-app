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
