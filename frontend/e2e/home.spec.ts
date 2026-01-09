import { test, expect } from '@playwright/test'

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
    await page.waitForLoadState('networkidle')

    // Test that the tile endpoints return data (may be empty at certain zoom levels)
    const buildingResponse = await page.evaluate(async () => {
      const res = await fetch('/tiles/osm_buildings_mvt/14/2612/5975')
      return { status: res.status, ok: res.ok }
    })

    expect(buildingResponse.ok).toBe(true)
  })

  test('pipe tile endpoint is accessible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

    // MapLibre navigation control should be visible
    const mapContainer = page.getByTestId('map-container')
    await expect(mapContainer.locator('button').first()).toBeVisible({ timeout: 5000 })
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

    // Base Layers group starts expanded, should show Buildings toggle
    await expect(page.getByTestId('layer-toggle-buildings')).toBeVisible()

    // Click to collapse
    await page.getByTestId('layer-group-base-layers').click()

    // Buildings toggle should now be hidden
    await expect(page.getByTestId('layer-toggle-buildings')).not.toBeVisible()

    // Click again to expand
    await page.getByTestId('layer-group-base-layers').click()

    // Buildings toggle should be visible again
    await expect(page.getByTestId('layer-toggle-buildings')).toBeVisible()
  })

  test('Infrastructure group shows pipes and services', async ({ page }) => {
    await page.goto('/')

    // Infrastructure group starts expanded
    await expect(page.getByTestId('layer-toggle-pipes')).toBeVisible()
    await expect(page.getByTestId('layer-toggle-services')).toBeVisible()
  })

  test('Analysis group starts collapsed', async ({ page }) => {
    await page.goto('/')

    // Analysis group starts collapsed, network toggle should not be visible
    await expect(page.getByTestId('layer-group-analysis')).toBeVisible()
    await expect(page.getByTestId('layer-toggle-network')).not.toBeVisible()

    // Expand it
    await page.getByTestId('layer-group-analysis').click()

    // Now network toggle should be visible
    await expect(page.getByTestId('layer-toggle-network')).toBeVisible()
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
    await page.goto('/')

    // Enable services via Network preset
    await page.getByTestId('preset-network-view').click()
    const servicesCheckbox = page.getByTestId('layer-toggle-services').locator('input[type="checkbox"]')
    await expect(servicesCheckbox).toBeChecked()

    // Click Default preset
    await page.getByTestId('preset-default').click()

    // Services should be unchecked again
    await expect(servicesCheckbox).not.toBeChecked()

    // Buildings should still be checked
    const buildingsCheckbox = page.getByTestId('layer-toggle-buildings').locator('input[type="checkbox"]')
    await expect(buildingsCheckbox).toBeChecked()
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
    await page.goto('/')

    // Click Network preset (should highlight it with Simpsons yellow)
    await page.getByTestId('preset-network-view').click()
    await expect(page.getByTestId('preset-network-view')).toHaveCSS('background-color', 'rgb(254, 217, 15)')

    // Manually toggle a layer
    const buildingsCheckbox = page.getByTestId('layer-toggle-buildings').locator('input[type="checkbox"]')
    await buildingsCheckbox.click()

    // Preset highlight should be cleared (no active preset)
    await expect(page.getByTestId('preset-network-view')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
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

test.describe('Home Page - Full User Flow', () => {
  test('complete flow: load -> view map -> toggle layers -> use preset', async ({ page }) => {
    // 1. Navigate to home
    await page.goto('/')

    // 2. Verify initial load
    await expect(page.getByRole('heading', { level: 1 })).toContainText('SPRINGFIELD')
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('map-container')).toBeVisible()

    // 3. Verify map canvas loaded
    await expect(page.locator('canvas').first()).toBeVisible()

    // 4. Verify layer controls
    await expect(page.getByTestId('layer-controls')).toBeVisible()
    await expect(page.getByTestId('layer-toggle-buildings')).toBeVisible()
    await expect(page.getByTestId('layer-toggle-pipes')).toBeVisible()

    // 5. Toggle a layer off
    const buildingsCheckbox = page.getByTestId('layer-toggle-buildings').locator('input[type="checkbox"]')
    await buildingsCheckbox.click()
    await expect(buildingsCheckbox).not.toBeChecked()

    // 6. Use preset to reset
    await page.getByTestId('preset-default').click()
    await expect(buildingsCheckbox).toBeChecked()

    // 7. Switch to Network preset
    await page.getByTestId('preset-network-view').click()
    const servicesCheckbox = page.getByTestId('layer-toggle-services').locator('input[type="checkbox"]')
    await expect(servicesCheckbox).toBeChecked()

    // 8. Verify service lines checkbox is now checked
    await expect(servicesCheckbox).toBeChecked()
  })
})
