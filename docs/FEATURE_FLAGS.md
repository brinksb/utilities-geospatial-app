# Feature Flags

This project uses a simple JSON-based feature flag system designed for trunk-based development.

## Why Feature Flags?

Feature flags enable:
- **Merging incomplete features** to main behind a disabled flag
- **Gradual rollout** - enable for some users/environments first
- **Quick rollback** - disable a flag instead of reverting code
- **Testing in production** - test features with flag off, enable when ready

## Configuration

Feature flags are defined in `config/features.json`:

```json
{
  "flags": {
    "NETWORK_OVERLAY": {
      "enabled": true,
      "description": "Show network graph overlay when clicking properties"
    },
    "NEW_SIDEBAR": {
      "enabled": false,
      "description": "Use redesigned sidebar component"
    },
    "DARK_MODE": {
      "enabled": false,
      "description": "Enable dark mode theme toggle"
    }
  }
}
```

## Backend Usage (Python)

```python
from app.features import features

# Check if a flag is enabled
if features.is_enabled("NETWORK_OVERLAY"):
    return network_overlay_response()

# Protect an endpoint
@router.get("/new-feature")
def new_feature_endpoint():
    if not features.is_enabled("NEW_FEATURE"):
        raise HTTPException(404, "Not found")
    return {"data": "new feature response"}
```

## Frontend Usage (TypeScript)

```typescript
import { features } from '@/lib/features';

// Check if a flag is enabled
if (features.isEnabled('NEW_SIDEBAR')) {
  return <NewSidebar />;
}
return <OldSidebar />;
```

## Testing with Feature Flags

Both implementations support overrides for testing:

### Backend Tests

```python
from app.features import features

def test_new_feature():
    features.override("NEW_FEATURE", True)
    try:
        response = client.get("/new-feature")
        assert response.status_code == 200
    finally:
        features.clear_overrides()
```

### Frontend Tests

```typescript
import { FeatureFlags } from '@/lib/features';

describe('MyComponent', () => {
  let features: FeatureFlags;

  beforeEach(() => {
    features = new FeatureFlags({
      flags: {
        MY_FLAG: { enabled: true, description: 'Test flag' }
      }
    });
  });

  it('renders when flag is enabled', () => {
    expect(features.isEnabled('MY_FLAG')).toBe(true);
  });
});
```

## Adding a New Flag

1. Add the flag to `config/features.json`:
   ```json
   {
     "flags": {
       "YOUR_NEW_FLAG": {
         "enabled": false,
         "description": "Description of what this flag controls"
       }
     }
   }
   ```

2. Use it in code:
   ```python
   # Backend
   if features.is_enabled("YOUR_NEW_FLAG"):
       # new behavior
   ```
   ```typescript
   // Frontend
   if (features.isEnabled('YOUR_NEW_FLAG')) {
     // new behavior
   }
   ```

3. Write tests using overrides

4. Merge to main (flag is off by default)

5. Enable in staging environment, test

6. Enable in production when ready

## Environment-Specific Configuration

For different environments, deploy different `config/features.json` files:

- **Development**: All experimental flags enabled
- **Staging**: New features enabled for testing
- **Production**: Only stable features enabled

## Migration to Database

This JSON-based system is designed to migrate to database-backed flags. The JSON structure maps directly to a database table:

```sql
CREATE TABLE feature_flags (
    name VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

When ready, update the `FeatureFlags` class to query the database instead of reading JSON.

## Best Practices

1. **Short-lived flags** - Remove flags once features are stable
2. **Descriptive names** - `NEW_CHECKOUT_FLOW` not `FLAG_1`
3. **Document purpose** - Use the description field
4. **Clean up** - Delete flags that are always enabled
5. **Test both states** - Test behavior with flag on AND off
