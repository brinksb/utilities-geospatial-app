# Trunk-Based Development

This project follows trunk-based development practices. This document explains why and how.

## What is Trunk-Based Development?

Trunk-based development is a branching model where:
- All developers commit to a single branch (`main`)
- Branches are short-lived (hours, not days)
- Code is always in a deployable state
- Feature flags hide incomplete work

## Why Trunk-Based Development?

1. **Reduces merge conflicts** - Small, frequent merges are easier
2. **Faster feedback** - CI runs on every commit
3. **Always deployable** - Main branch is always production-ready
4. **Enables continuous deployment** - Deploy on every merge

## Our Implementation

### Branch Strategy

```
main (trunk)
  ├── feature/short-lived-branch (hours, not days)
  ├── fix/quick-bugfix
  └── ... (merge back quickly)
```

### CI/CD Pipeline

```
PR Created
    ↓
CI Runs (tests, lint)
    ↓
PR Review (keep it short)
    ↓
Merge to main
    ↓
Auto-deploy to staging
    ↓
Manual promotion to production (if needed)
```

### GitHub Branch Protection (Recommended)

Configure these settings on `main`:

1. **Require pull request before merging**
   - Require 1 approval (or 0 for solo projects)
   - Dismiss stale reviews on new commits

2. **Require status checks to pass**
   - `test` job from CI workflow
   - `pr-quality` job from PR checks

3. **Require branches to be up to date**
   - Ensures CI runs against latest main

4. **Auto-merge** (optional but recommended)
   - Enable auto-merge for PRs
   - Merges automatically when checks pass

## Practices

### 1. Small PRs

- PRs should be reviewable in 15 minutes
- One logical change per PR
- If it's too big, split it

**Bad**: "Add user authentication system" (500 lines)
**Good**: "Add JWT validation middleware" (50 lines)

### 2. Short-Lived Branches

- Create branch → work → PR → merge → delete
- Target: < 1 day from branch to merge
- If it takes longer, the PR is too big

### 3. Feature Flags for Incomplete Work

```typescript
// Instead of long-lived feature branches:
if (featureFlags.newDashboard) {
  return <NewDashboard />
}
return <OldDashboard />
```

This lets you:
- Merge incomplete features to main
- Test in production with flag off
- Gradually roll out to users

### 4. Fast CI

Our CI should complete in < 10 minutes:
- Backend tests: ~2 min
- Frontend tests: ~2 min
- E2E tests: ~3 min
- Total: ~7 min (with parallelization)

If CI is slow, developers won't wait for it.

### 5. Fix Forward, Not Rollback

If something breaks in main:
1. Don't revert (creates noise)
2. Fix it with a new commit
3. Deploy the fix

Exception: Critical security issues → revert immediately

## Anti-Patterns to Avoid

### ❌ Long-Lived Feature Branches

```
main ──────────────────────────────────►
       \                              /
        └── feature/big-thing ───────┘
            (2 weeks, 50 commits, merge conflicts)
```

### ❌ Release Branches

```
main ──────────────────────────────────►
       \
        └── release/v1.2 ──────────────►
            (diverges, needs backports)
```

### ❌ Waiting for "Ready" Code

If code isn't ready to merge, use a feature flag.
Don't let it sit in a branch for weeks.

### ❌ Manual Testing Before Merge

Tests should be automated. If you need manual testing:
1. Merge with feature flag off
2. Test in staging
3. Enable flag when ready

## Checklist for PRs

Before merging, ensure:

- [ ] Tests pass (CI green)
- [ ] PR is small (< 200 lines ideally)
- [ ] Changes are behind feature flag if incomplete
- [ ] No console.logs or debug code
- [ ] Migrations are idempotent
- [ ] Documentation updated if needed

## Recommended GitHub Settings

### Repository Settings → Branches → Branch Protection

```yaml
Branch name pattern: main

Protect matching branches:
  ✓ Require a pull request before merging
    ✓ Require approvals: 1 (or 0)
    ✓ Dismiss stale pull request approvals when new commits are pushed
  ✓ Require status checks to pass before merging
    ✓ Require branches to be up to date before merging
    Status checks: test, pr-quality
  ✓ Do not allow bypassing the above settings
```

### Repository Settings → General → Pull Requests

```yaml
✓ Allow auto-merge
✓ Automatically delete head branches
```

## Resources

- [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/)
- [Google's Trunk-Based Development](https://cloud.google.com/architecture/devops/devops-tech-trunk-based-development)
- [Feature Flags Best Practices](https://launchdarkly.com/blog/feature-flag-best-practices/)
