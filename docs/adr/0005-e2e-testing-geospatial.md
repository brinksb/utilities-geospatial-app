# ADR 0005: E2E Testing Strategy for Geospatial Applications

## Status
Accepted

## Context
Testing map-based applications with MVT tiles and Deck.gl presents unique challenges:

1. **WebGL rendering** - Map renders to canvas, not DOM elements
2. **MVT tiles** - Binary data, not inspectable HTML
3. **Click interactions** - Deck.gl handles picking internally, not via DOM events
4. **Timing** - Tiles load asynchronously, map initializes after page load

Traditional E2E selectors (`getByText`, `getByRole`) don't work for map content.

## Decision
We adopted a **multi-layer testing strategy** using Playwright:

### Layer 1: Structure Tests
Verify DOM structure exists without testing map internals:
```typescript
await expect(page.getByTestId('sidebar')).toBeVisible()
await expect(page.getByTestId('map-container')).toBeVisible()
await expect(page.locator('canvas').first()).toBeVisible()
```

### Layer 2: Network Verification
Intercept requests to verify tile and API calls:
```typescript
await page.route('**/tiles/properties_mvt/**', (route) => {
  tileRequests.push(route.request().url())
  route.continue()
})
// Verify tile URL format: /tiles/properties_mvt/{z}/{x}/{y}
```

### Layer 3: State Change Verification
Test that UI updates when data loads or interactions occur:
```typescript
// Set up listener BEFORE navigation to catch fast responses
const responsePromise = page.waitForResponse(r =>
  r.url().includes('/api/properties')
)
await page.goto('/')
await responsePromise
await expect(page.getByTestId('property-card').first()).toBeVisible()
```

### Layer 4: Canvas Interactions
Click on canvas and verify resulting state changes:
```typescript
const canvas = page.locator('canvas').first()
const box = await canvas.boundingBox()
await page.mouse.click(box.x + box.width/2, box.y + box.height/2)
// Verify API call or UI update resulted from click
```

## Consequences

### Positive
- Tests verify real tile loading without mocking MVT data
- Network interception catches actual z/x/y tile requests
- Canvas clicks test Deck.gl picking infrastructure
- Test IDs provide stable selectors for non-map UI

### Negative
- Cannot assert specific features are visible on map
- Canvas clicks may or may not hit features (position-dependent)
- Requires longer timeouts for tile loading

### Key Patterns

**Always set up response listeners before navigation:**
```typescript
const responsePromise = page.waitForResponse(...)
await page.goto('/')  // Response may complete during load
await responsePromise
```

**Use test IDs for non-map elements:**
```typescript
<div data-testid="sidebar">
<div data-testid="property-list">
<div data-testid="selected-property">
```

**Playwright config for Docker:**
```typescript
// Inside Docker, use nginx service name
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://nginx:80'
```

### Test Coverage Achieved
- 14 E2E tests covering structure, data loading, tile requests, sidebar interactions, and full user flows
- Verifies MVT tiles are requested with proper z/x/y coordinates
- Verifies property list loads and sidebar interactions work
