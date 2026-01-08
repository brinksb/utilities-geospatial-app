import { describe, it, expect, beforeEach } from 'vitest'
import { LegendService, LegendItem } from '@/services/LegendService'
import { LayerConfig } from '@/services/LayerManager'

describe('LegendService', () => {
  let legendService: LegendService

  const testLayers: LayerConfig[] = [
    {
      id: 'properties',
      name: 'Properties',
      type: 'mvt',
      visible: true,
      style: {
        fillColor: '#3B82F6',
      },
    },
    {
      id: 'network',
      name: 'Network',
      type: 'geojson',
      visible: false,
      style: {
        lineColor: '#FF8C00',
      },
    },
    {
      id: 'categorized',
      name: 'Categorized Layer',
      type: 'mvt',
      visible: true,
      style: {},
      categorical: {
        property: 'type',
        colors: {
          Residential: '#22C55E',
          Commercial: '#3B82F6',
          Industrial: '#EF4444',
        },
      },
    },
  ]

  beforeEach(() => {
    legendService = new LegendService()
  })

  describe('getLegendForLayer', () => {
    it('returns empty array for layer without style config', () => {
      const layer: LayerConfig = {
        id: 'empty',
        name: 'Empty',
        type: 'mvt',
        visible: true,
        style: {},
      }
      const legend = legendService.getLegendForLayer(layer)
      expect(legend).toEqual([])
    })

    it('generates single legend item from fillColor', () => {
      const legend = legendService.getLegendForLayer(testLayers[0])
      expect(legend).toHaveLength(1)
      expect(legend[0]).toEqual({
        label: 'Properties',
        color: '#3B82F6',
      })
    })

    it('generates single legend item from lineColor', () => {
      const legend = legendService.getLegendForLayer(testLayers[1])
      expect(legend).toHaveLength(1)
      expect(legend[0]).toEqual({
        label: 'Network',
        color: '#FF8C00',
      })
    })

    it('generates legend items from categorical style', () => {
      const legend = legendService.getLegendForLayer(testLayers[2])
      expect(legend).toHaveLength(3)
      expect(legend).toContainEqual({ label: 'Residential', color: '#22C55E' })
      expect(legend).toContainEqual({ label: 'Commercial', color: '#3B82F6' })
      expect(legend).toContainEqual({ label: 'Industrial', color: '#EF4444' })
    })
  })

  describe('getLegendForVisibleLayers', () => {
    it('returns legends only for visible layers', () => {
      const legends = legendService.getLegendForVisibleLayers(testLayers)
      // properties and categorized are visible
      expect(Object.keys(legends)).toHaveLength(2)
      expect(legends['properties']).toBeDefined()
      expect(legends['categorized']).toBeDefined()
      expect(legends['network']).toBeUndefined()
    })

    it('returns empty object when no visible layers', () => {
      const hiddenLayers = testLayers.map(l => ({ ...l, visible: false }))
      const legends = legendService.getLegendForVisibleLayers(hiddenLayers)
      expect(Object.keys(legends)).toHaveLength(0)
    })
  })
})
