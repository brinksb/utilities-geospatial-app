# Authentication Patterns

This document describes authentication patterns for future implementation. These patterns are **not implemented** in this demo but are documented for reference.

## Overview

For production deployments, this application would benefit from:
- AWS Cognito for identity management
- JWT token validation in FastAPI
- react-oidc-context for frontend authentication
- Role-based access control (RBAC)

## Cognito Integration (Backend)

### JWT Validation Middleware

```python
# backend/app/auth/cognito.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from jose import jwt, JWTError
import httpx

security = HTTPBearer()

COGNITO_REGION = "us-east-1"
COGNITO_USER_POOL_ID = "your-pool-id"
COGNITO_CLIENT_ID = "your-client-id"

JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"

async def get_current_user(token: str = Depends(security)):
    """Validate Cognito JWT token."""
    try:
        # Fetch JWKS (cache in production)
        async with httpx.AsyncClient() as client:
            resp = await client.get(JWKS_URL)
            jwks = resp.json()

        # Decode and validate token
        payload = jwt.decode(
            token.credentials,
            jwks,
            algorithms=["RS256"],
            audience=COGNITO_CLIENT_ID,
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=str(e))
```

### Protected Endpoint Example

```python
from app.auth.cognito import get_current_user

@router.post("/properties")
async def create_property(
    data: PropertyCreate,
    user: dict = Depends(get_current_user),
):
    # User is authenticated
    user_id = user["sub"]
    # ... create property
```

## Frontend Integration

### react-oidc-context Setup

```typescript
// frontend/src/app/providers.tsx
import { AuthProvider } from 'react-oidc-context'

const cognitoConfig = {
  authority: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
  client_id: CLIENT_ID,
  redirect_uri: window.location.origin,
  scope: 'openid profile email',
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider {...cognitoConfig}>
      {children}
    </AuthProvider>
  )
}
```

### Protected Route HOC

```typescript
// frontend/src/components/withAuth.tsx
import { useAuth } from 'react-oidc-context'
import { useRouter } from 'next/navigation'

export function withAuth<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedRoute(props: P) {
    const auth = useAuth()
    const router = useRouter()

    if (auth.isLoading) {
      return <div>Loading...</div>
    }

    if (!auth.isAuthenticated) {
      router.push('/login')
      return null
    }

    return <Component {...props} />
  }
}
```

### Using Protected Routes

```typescript
// frontend/src/app/admin/page.tsx
'use client'

import { withAuth } from '@/components/withAuth'

function AdminPage() {
  return <div>Admin content here</div>
}

export default withAuth(AdminPage)
```

## Role-Based Access Control (RBAC)

### Token Claims

Cognito can include custom claims in tokens:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "cognito:groups": ["admin", "viewer"],
  "custom:organization_id": "org-123"
}
```

### Backend RBAC Middleware

```python
from functools import wraps
from fastapi import HTTPException

def require_role(role: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, user: dict, **kwargs):
            groups = user.get("cognito:groups", [])
            if role not in groups:
                raise HTTPException(403, "Insufficient permissions")
            return await func(*args, user=user, **kwargs)
        return wrapper
    return decorator

@router.delete("/properties/{id}")
@require_role("admin")
async def delete_property(id: int, user: dict = Depends(get_current_user)):
    # Only admins can delete
    ...
```

### Frontend Role Checks

```typescript
// frontend/src/hooks/useRoles.ts
import { useAuth } from 'react-oidc-context'

export function useRoles() {
  const auth = useAuth()
  const groups = auth.user?.profile?.['cognito:groups'] as string[] || []

  return {
    isAdmin: groups.includes('admin'),
    isViewer: groups.includes('viewer'),
    hasRole: (role: string) => groups.includes(role),
  }
}
```

## Security Considerations

1. **Token Storage**: Use httpOnly cookies or secure token storage
2. **CORS**: Configure allowed origins in FastAPI middleware
3. **Token Refresh**: Implement automatic token refresh
4. **Logout**: Clear tokens and Cognito session
5. **Multi-tenancy**: Use organization claims for data isolation

## Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [react-oidc-context](https://github.com/authts/react-oidc-context)
- [python-jose](https://python-jose.readthedocs.io/)
