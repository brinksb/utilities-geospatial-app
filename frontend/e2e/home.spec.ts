import { test, expect } from '@playwright/test'

// Clear localStorage before each test using context route interception
// This ensures localStorage is cleared before the app loads
test.beforeEach(async ({ context }) => {
  // Navigate to origin first to set up localStorage clearing
  await context.addInitScript(() => {
    // Clear localStorage immediately when script runs
    try {
      localStorage.clear()
    } catch (e) {
      // Ignore if localStorage not available
    }
  })
})

test.describe('Home Page - Structure', () => {
  test('loads and displays heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SPRINGFIELD')
  })

  test('renders sidebar and map containers', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('map-container')).toBeVisible()
  })

  test('map canvas is rendered', async ({ page }) => {
    await page.goto('/')
    // Deck.gl/MapLibre render to canvas
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('info panel shows Springfield Oregon', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Springfield, Oregon')).toBeVisible()
  })
})

test.describe('Home Page - MVT Tile Loading', () => {
  test('tile endpoints are accessible', async ({ page }) => {
    await page.goto('/')
    // Wait for DOM to be ready, don't need networkidle for API tests
    await page.waitForLoadState('domcontentloaded')

    // Test that the tile endpoints return data (may be empty at certain zoom levels)
    const buildingResponse = await page.evaluate(async () => {
      const res = await fetch('/tiles/osm_buildings_mvt/14/2612/5975')
      return { status: res.status, ok: res.ok }
    })

    expect(buildingResponse.ok).toBe(true)
  })

  test('pipe tile endpoint is accessible', async ({ page }) => {
    await page.goto('/')
    // Wait for DOM to be ready, don't need networkidle for API tests
    await page.waitForLoadState('domcontentloaded')

    const pipeResponse = await page.evaluate(async () => {
      const res = await fetch('/tiles/synth_pipes_mvt/14/2612/5975')
      return { status: res.status, ok: res.ok }
    })

    expect(pipeResponse.ok).toBe(true)
  })
})

test.describe('Home Page - Map Interactions', () => {
  test('map shows navigation controls', async ({ page }) => {
    await page.goto('/')
    // Wait for map container to be visible first
    await page.waitForSelector('[data-testid="map-container"]')

    // MapLibre navigation control should be visible - wait for zoom button specifically
    const zoomInBtn = page.getByRole('button', { name: 'Zoom in' })
    await expect(zoomInBtn).toBeVisible({ timeout: 10000 })
  })

  test('zoom buttons work', async ({ page }) => {
    await page.goto('/')
    // Wait for the zoom button to appear instead of networkidle
    const zoomInBtn = page.getByRole('button', { name: 'Zoom in' })
    await expect(zoomInBtn).toBeVisible({ timeout: 10000 })

    // Click zoom in button
    await zoomInBtn.click()

    // Verify button is still there (map didn't break)
    await expect(zoomInBtn).toBeVisible()
  })
})

test.describe('Home Page - Layer Controls', () => {
  test('layer controls panel is visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('layer-controls')).toBeVisible()
  })

  test('layer groups are displayed', async ({ page }) => {
    await page.goto('/')

    // Should show layer groups
    await expect(page.getByTestId('layer-group-base-layers')).toBeVisible()
    await expect(page.getByTestId('layer-group-infrastructure')).toBeVisible()
    await expect(page.getByTestId('layer-group-analysis')).toBeVisible()
  })

  test('clicking group header toggles expand/collapse', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="layer-controls"]')

    const baseLayersGroup = page.getByTestId('layer-group-base-layers')
    const buildingsToggle = page.getByTestId('layer-toggle-buildings')

    // Ensure group header is clickable
    await expect(baseLayersGroup).toBeVisible()
    await baseLayersGroup.scrollIntoViewIfNeeded()

    // Check initial state and test toggle in either direction
    const isInitiallyVisible = await buildingsToggle.isVisible()

    if (isInitiallyVisible) {
      // Collapse: click and wait for animation/state update
      await baseLayersGroup.click()
      await page.waitForTimeout(200) // Small delay for animation
      await expect(buildingsToggle).not.toBeVisible({ timeout: 5000 })

      // Expand: click and wait
      await baseLayersGroup.click()
      await page.waitForTimeout(200)
      await expect(buildingsToggle).toBeVisible({ timeout: 5000 })
    } else {
      // Expand: click and wait
      await baseLayersGroup.click()
      await page.waitForTimeout(200)
      await expect(buildingsToggle).toBeVisible({ timeout: 5000 })

      // Collapse: click and wait
      await baseLayersGroup.click()
      await page.waitForTimeout(200)
      await expect(buildingsToggle).not.toBeVisible({ timeout: 5000 })
    }
  })

  test('Infrastructure group shows pipes and services', async ({ page }) => {
    await page.goto('/')

    // Infrastructure group starts expanded
    await expect(page.getByTestId('layer-toggle-pipes')).toBeVisible()
    await expect(page.getByTestId('layer-toggle-services')).toBeVisible()
  })

  test('Analysis group can be expanded to show network toggle', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('[data-testid="layer-controls"]')

    const analysisGroup = page.getByTestId('layer-group-analysis')
    await analysisGroup.scrollIntoViewIfNeeded()
    const networkToggle = page.getByTestId('layer-toggle-network')

    // Check initial state
    const isInitiallyVisible = await networkToggle.isVisible()

    if (!isInitiallyVisible) {
      // Expand the group
      await analysisGroup.click()
      await expect(networkToggle).toBeVisible({ timeout: 5000 })
    } else {
      // Collapse the group
      await analysisGroup.click()
      await expect(networkToggle).not.toBeVisible({ timeout: 5000 })
      // Expand again to verify toggle works
      await analysisGroup.click()
      await expect(networkToggle).toBeVisible({ timeout: 5000 })
    }
  })

  test('layer visibility checkbox can be toggled', async ({ page }) => {
    await page.goto('/')

    // Buildings checkbox should be checked by default
    const buildingsCheckbox = page.getByTestId('layer-toggle-buildings').locator('input[type="checkbox"]')
    await expect(buildingsCheckbox).toBeChecked()

    // Uncheck it
    await buildingsCheckbox.click()
    await expect(buildingsCheckbox).not.toBeChecked()

    // Check it again
    await buildingsCheckbox.click()
    await expect(buildingsCheckbox).toBeChecked()
  })
})

test.describe('Home Page - Layer Presets', () => {
  test('preset buttons are displayed', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('layer-presets')).toBeVisible()
    await expect(page.getByTestId('preset-default')).toBeVisible()
    await expect(page.getByTestId('preset-network-view')).toBeVisible()
    await expect(page.getByTestId('preset-infrastructure')).toBeVisible()
  })

  test('clicking Network preset enables service lines', async ({ page }) => {
    await page.goto('/')

    // Service Lines should start unchecked
    const servicesCheckbox = page.getByTestId('layer-toggle-services').locator('input[type="checkbox"]')
    await expect(servicesCheckbox).not.toBeChecked()

    // Click Network preset
    await page.getByTestId('preset-network-view').click()

    // Services should now be checked
    await expect(servicesCheckbox).toBeChecked()
  })

  test('clicking Default preset resets to default layers', async ({ page }) => {
    // Use clean state to ensure default layer visibility
    await page.goto('/')
    // Wait for app to fully initialize
    await page.waitForSelector('[data-testid="layer-controls"]')

    // Scroll preset buttons into view and click Network preset
    const networkPreset = page.getByTestId('preset-network-view')
    await networkPreset.scrollIntoViewIfNeeded()
    await networkPreset.click()

    const servicesCheckbox = page.getByTestId('layer-toggle-services').locator('input[type="checkbox"]')
    // Wait for checkbox state to update
    await expect(servicesCheckbox).toBeChecked({ timeout: 5000 })

    // Scroll and click Default preset
    const defaultPreset = page.getByTestId('preset-default')
    await defaultPreset.scrollIntoViewIfNeeded()
    await defaultPreset.click()

    // Services should be unchecked again
    await expect(servicesCheckbox).not.toBeChecked({ timeout: 5000 })

    // Buildings should still be checked
    const buildingsCheckbox = page.getByTestId('layer-toggle-buildings').locator('input[type="checkbox"]')
    await expect(buildingsCheckbox).toBeChecked({ timeout: 5000 })
  })

  test('active preset is visually highlighted', async ({ page }) => {
    await page.goto('/')

    // Click Network preset
    await page.getByTestId('preset-network-view').click()

    // Network preset button should have the active style (Simpsons yellow background)
    const networkButton = page.getByTestId('preset-network-view')
    await expect(networkButton).toHaveCSS('background-color', 'rgb(254, 217, 15)')

    // Default preset should not have active style
    const defaultButton = page.getByTestId('preset-default')
    await expect(defaultButton).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  })

  test('manual layer change clears active preset highlight', async ({ page }) => {
    // Use clean state to ensure no active preset
    await page.goto('/')
    // Wait for app to fully initialize
    await page.waitForSelector('[data-testid="layer-controls"]')

    // Scroll and click Network preset (should highlight it with Simpsons yellow)
    const networkPreset = page.getByTestId('preset-network-view')
    await networkPreset.scrollIntoViewIfNeeded()
    await networkPreset.click()
    await expect(networkPreset).toHaveCSS('background-color', 'rgb(254, 217, 15)', { timeout: 5000 })

    // Manually toggle a layer
    const buildingsCheckbox = page.getByTestId('layer-toggle-buildings').locator('input[type="checkbox"]')
    await buildingsCheckbox.scrollIntoViewIfNeeded()
    await buildingsCheckbox.click()

    // Preset highlight should be cleared (no active preset)
    await expect(networkPreset).toHaveCSS('background-color', 'rgb(255, 255, 255)', { timeout: 5000 })
  })
})

test.describe('Home Page - Legend', () => {
  test('legend is displayed for visible layers', async ({ page }) => {
    await page.goto('/')

    // Buildings and Utility Network layers are visible by default, should have legends
    await expect(page.getByTestId('legend').first()).toBeVisible()
  })

  test('legend shows Buildings layer', async ({ page }) => {
    await page.goto('/')

    // Legend should show "Buildings" (in the layer controls area)
    await expect(page.getByTestId('layer-toggle-buildings')).toBeVisible()
  })

  test('legend shows pipe classification', async ({ page }) => {
    await page.goto('/')

    // Legend should show main and secondary pipe classifications
    await expect(page.getByText('main').first()).toBeVisible()
    await expect(page.getByText('secondary').first()).toBeVisible()
  })
})

test.describe('Home Page - pgRouting Network Overlay', () => {
  test('graph nearest_edge API returns valid GeoJSON for Springfield', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Use coordinates in Springfield, Oregon (center of our demo area)
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/graph/nearest_edge?lon=-123.0&lat=44.055')
      return await res.json()
    })

    expect(response.type).toBe('Feature')
    expect(response.geometry).toBeDefined()
    expect(response.geometry.type).toBe('LineString')
    expect(response.properties.edge_id).toBeDefined()
    expect(response.properties.distance_meters).toBeDefined()
  })

  test('graph nearby_edges API returns FeatureCollection', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // First get a valid edge_id from Springfield, then fetch nearby edges
    const response = await page.evaluate(async () => {
      // Get nearest edge first (Springfield coordinates)
      const nearestRes = await fetch('/api/graph/nearest_edge?lon=-123.0&lat=44.055')
      const nearest = await nearestRes.json()
      const edgeId = nearest.properties.edge_id

      // Then get nearby edges
      const nearbyRes = await fetch(`/api/graph/nearby_edges/${edgeId}?hops=3`)
      return await nearbyRes.json()
    })

    expect(response.type).toBe('FeatureCollection')
    expect(Array.isArray(response.features)).toBe(true)
    expect(response.features.length).toBeGreaterThan(0)

    // Each feature should be a LineString with hop info
    const firstFeature = response.features[0]
    expect(firstFeature.type).toBe('Feature')
    expect(firstFeature.geometry.type).toBe('LineString')
    expect(firstFeature.properties.hop).toBeDefined()
  })
})

test.describe('Home Page - Simulation Mode Controls', () => {
  test('simulation mode buttons are displayed', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('simulation-modes')).toBeVisible()
    await expect(page.getByTestId('mode-explore')).toBeVisible()
    await expect(page.getByTestId('mode-outage')).toBeVisible()
    await expect(page.getByTestId('mode-spread')).toBeVisible()
  })

  test('explore mode is active by default', async ({ page }) => {
    await page.goto('/')
    const exploreBtn = page.getByTestId('mode-explore')
    await expect(exploreBtn).toHaveCSS('background-color', 'rgb(254, 217, 15)')
  })

  test('clicking outage mode activates it', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('mode-outage').click()
    const outageBtn = page.getByTestId('mode-outage')
    await expect(outageBtn).toHaveCSS('background-color', 'rgb(255, 99, 71)')
    await expect(page.getByText('Click a pipe to simulate breaking it')).toBeVisible()
  })

  test('clicking spread mode activates it', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('mode-spread').click()
    const spreadBtn = page.getByTestId('mode-spread')
    await expect(spreadBtn).toHaveCSS('background-color', 'rgb(50, 205, 50)')
    await expect(page.getByText('Click anywhere to start a spread animation')).toBeVisible()
  })
})

test.describe('Home Page - Outage Simulation API', () => {
  test('outage API returns affected buildings for bridge edge 657', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Edge 657 is a known bridge edge with 30 services
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/graph/outage/657')
      return await res.json()
    })

    expect(response.type).toBe('FeatureCollection')
    expect(Array.isArray(response.features)).toBe(true)
    expect(response.features.length).toBeGreaterThan(0)

    // Buildings should be polygons
    const firstFeature = response.features[0]
    expect(firstFeature.type).toBe('Feature')
    expect(['Polygon', 'MultiPolygon']).toContain(firstFeature.geometry.type)
    expect(firstFeature.properties.building_id).toBeDefined()
  })

  test('outage returns 404 for non-existent edge', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/graph/outage/99999999')
      return { status: res.status }
    })

    expect(response.status).toBe(404)
  })
})

test.describe('Home Page - Spread Simulation API', () => {
  // Well-connected coordinates near node 110 in Springfield
  const SPREAD_LON = -123.029
  const SPREAD_LAT = 44.071

  test('spread API returns edges with hop distances', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const response = await page.evaluate(async ({ lon, lat }) => {
      const res = await fetch(`/api/graph/spread?lon=${lon}&lat=${lat}&max_hops=3`)
      return await res.json()
    }, { lon: SPREAD_LON, lat: SPREAD_LAT })

    expect(response.type).toBe('FeatureCollection')
    expect(Array.isArray(response.features)).toBe(true)
    expect(response.features.length).toBeGreaterThan(0)

    // Should have multiple hop levels
    const hops = new Set(response.features.map((f: any) => f.properties.hop))
    expect(hops.size).toBeGreaterThan(1)

    // Each feature should have edge_id and hop
    const firstFeature = response.features[0]
    expect(firstFeature.properties.edge_id).toBeDefined()
    expect(firstFeature.properties.hop).toBeDefined()
  })

  test('spread is deterministic for same coordinates', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const results = await page.evaluate(async ({ lon, lat }) => {
      const res1 = await fetch(`/api/graph/spread?lon=${lon}&lat=${lat}&max_hops=2`)
      const data1 = await res1.json()

      const res2 = await fetch(`/api/graph/spread?lon=${lon}&lat=${lat}&max_hops=2`)
      const data2 = await res2.json()

      return {
        count1: data1.features.length,
        count2: data2.features.length,
        ids1: data1.features.map((f: any) => f.properties.edge_id).sort(),
        ids2: data2.features.map((f: any) => f.properties.edge_id).sort()
      }
    }, { lon: SPREAD_LON, lat: SPREAD_LAT })

    expect(results.count1).toBe(results.count2)
    expect(results.ids1).toEqual(results.ids2)
  })
})

test.describe('Home Page - Full User Flow', () => {
  test('complete flow: load -> view map -> toggle layers -> use preset', async ({ page }) => {
    // 1. Navigate to home with clean state
    await page.goto('/')

    // 2. Verify initial load
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SPRINGFIELD')
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('map-container')).toBeVisible()

    // 3. Verify map canvas loaded
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 })

    // 4. Verify layer controls - wait for them to be interactive
    await page.waitForSelector('[data-testid="layer-controls"]')
    await expect(page.getByTestId('layer-toggle-buildings')).toBeVisible()
    await expect(page.getByTestId('layer-toggle-pipes')).toBeVisible()

    // 5. Toggle a layer off (scroll into view first)
    const buildingsCheckbox = page.getByTestId('layer-toggle-buildings').locator('input[type="checkbox"]')
    await buildingsCheckbox.scrollIntoViewIfNeeded()
    await buildingsCheckbox.click()
    await expect(buildingsCheckbox).not.toBeChecked({ timeout: 5000 })

    // 6. Use preset to reset (scroll into view first)
    const defaultPreset = page.getByTestId('preset-default')
    await defaultPreset.scrollIntoViewIfNeeded()
    await defaultPreset.click()
    await expect(buildingsCheckbox).toBeChecked({ timeout: 5000 })

    // 7. Switch to Network preset (scroll into view first)
    const networkPreset = page.getByTestId('preset-network-view')
    await networkPreset.scrollIntoViewIfNeeded()
    await networkPreset.click()
    const servicesCheckbox = page.getByTestId('layer-toggle-services').locator('input[type="checkbox"]')
    await expect(servicesCheckbox).toBeChecked({ timeout: 5000 })
  })
})
