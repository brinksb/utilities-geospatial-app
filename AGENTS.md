# Team Values and Working Agreements

This document captures the principles and practices for contributors working on this project, whether human or AI.

## Core Principles

### 1. Test-Driven Development (TDD)
**Write tests first. Always.**

The TDD cycle is non-negotiable:
1. **Red**: Write a failing test that describes the desired behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

Why TDD matters:
- Prior iterations of this project had zero tests - that doesn't scale
- Tests document expected behavior
- Tests catch regressions early
- Tests enable confident refactoring

### 2. Idempotent Operations
**Every operation should be safe to run multiple times.**

This applies to:
- Database migrations (use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- Deploy scripts (re-running `./deploy.sh` should be safe)
- Data seeding (use upsert patterns)

### 3. Docker-First Development
**If it doesn't run in Docker, it doesn't run.**

Benefits:
- Consistent environments across developers
- No "works on my machine" issues
- Easy onboarding: `./deploy.sh` gets anyone started

### 4. Documentation as Code
**Keep docs close to what they document.**

- ADRs live in `docs/adr/` for architectural decisions
- CLAUDE.md for AI agents working on this codebase
- Code comments for non-obvious logic (but prefer self-documenting code)

## Working Agreements

### For Code Changes

1. **Read before you write**
   - Understand existing patterns before adding new code
   - Check how similar features are implemented
   - Respect the established architecture

2. **Small, focused changes**
   - One logical change per commit
   - PRs should be reviewable in one sitting
   - Avoid mixing refactoring with features

3. **Tests are mandatory**
   - No feature is complete without tests
   - Backend: pytest
   - Frontend: Vitest (unit), Playwright (E2E)
   - Target: meaningful coverage, not 100%

4. **Keep it simple**
   - Avoid over-engineering
   - Don't add features "for later"
   - Three similar lines > premature abstraction

### For AI Agents

If you're an AI agent working on this codebase:

1. **Respect the existing patterns**
   - Check existing code before implementing new features
   - Match the style and conventions already in use
   - Don't introduce new frameworks without discussion

2. **Write tests first**
   - Create failing tests before implementation
   - Run tests after changes to verify nothing broke
   - Include both happy path and error cases

3. **Commit messages matter**
   - Use clear, descriptive commit messages
   - Reference issue numbers when applicable
   - Include `Co-Authored-By` attribution

4. **Don't over-solve**
   - Address the specific request
   - Avoid adding unrequested features
   - Ask if scope is unclear

### Communication

1. **Be explicit about uncertainty**
   - "I'm not sure, but..." is fine
   - Don't guess when you can ask
   - Document assumptions

2. **Show your work**
   - Explain architectural decisions
   - Link to relevant ADRs
   - Use diagrams for complex flows

3. **Ask good questions**
   - Provide context
   - Suggest options when possible
   - Be specific about what you need

## Quality Standards

### Code Quality
- TypeScript strict mode (frontend)
- Python type hints (backend)
- Lint and format before commit
- No commented-out code

### Test Quality
- Tests should be deterministic
- Tests should be fast
- Tests should be independent
- Tests should be readable

### Documentation Quality
- Keep it current
- Keep it concise
- Keep it useful

## Definition of Done

A feature is done when:
- [ ] Tests written and passing
- [ ] Code reviewed (or self-reviewed for solo work)
- [ ] Documentation updated if needed
- [ ] No new linting errors
- [ ] Runs correctly in Docker

## Onboarding Checklist

New to the project? Do this:
1. Read this file (AGENTS.md)
2. Read CLAUDE.md for codebase overview
3. Run `./deploy.sh` to start services
4. Run `./test.sh` to verify all tests pass
5. Read relevant ADRs in `docs/adr/`
6. Pick a small issue to start
