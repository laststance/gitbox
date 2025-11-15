<!--
Sync Impact Report:
Version Change: 1.0.0 → 1.1.0
Principles Modified:
  - Added VII. Japanese-First Documentation & Communication

Rationale for MINOR version bump:
  - New principle added (Japanese-first communication)
  - Backward compatible - doesn't remove or redefine existing principles
  - Materially expands guidance for documentation and communication standards

Templates Status:
  ✅ plan-template.md - Aligned with constitution checks
  ✅ spec-template.md - Aligned with user story and acceptance criteria requirements
  ✅ tasks-template.md - Aligned with test-first and deployment requirements

Follow-up TODOs: None
-->

# Vibe Rush Constitution

## Core Principles

### I. Browser Verification Mandatory

**Rule**: Every feature implementation MUST be verified in an actual browser using Playwright MCP tool before task completion.

**Requirements**:
- Visual verification via screenshots is mandatory
- Functional verification via interaction testing is mandatory
- NO task may be marked complete without browser verification
- Screenshots must demonstrate the feature working as specified

**Rationale**: Visual bugs, layout issues, and interaction problems are only detectable in real browsers. Code review alone is insufficient for UI/UX quality assurance.

### II. E2E Testing for Critical Flows

**Rule**: All happy path user journeys MUST have E2E test coverage.

**Requirements**:
- Authentication flows must have E2E tests
- Core Kanban operations (create board, add card, drag & drop) must have E2E tests
- Project Info modal operations must have E2E tests
- Tests must use Playwright for browser automation
- Tests must validate both functionality and visual presentation

**Rationale**: E2E tests ensure user-facing features work end-to-end, catching integration issues that unit tests miss.

### III. Clear Documentation & User Guidance

**Rule**: All code must have clear docstrings explaining what the application/component does.

**Requirements**:
- Every component must have a docstring describing its purpose
- Every API endpoint must document its behavior
- Complex business logic must include explanatory comments
- User-facing configuration (Vercel, Supabase) must be documented with clear setup instructions

**Rationale**: Clear documentation enables team collaboration, easier onboarding, and reduces cognitive load during maintenance.

### IV. Accessibility & WCAG Compliance

**Rule**: All UI components MUST meet WCAG AA standards for accessibility.

**Requirements**:
- Text content must meet 4.5:1 contrast ratio
- UI components/icons must meet 3:1 contrast ratio
- All 12 themes must pass automated contrast validation
- Build must fail if contrast requirements are not met
- Keyboard navigation must be fully supported

**Rationale**: Accessibility is a fundamental requirement, not an optional feature. WCAG compliance ensures the application is usable by everyone.

### V. Security-First Development

**Rule**: Security requirements MUST be implemented and verified before deployment.

**Requirements**:
- Credentials must use one of three approved patterns: reference links, AES-256-GCM encryption, or external management
- Encrypted credentials require 2FA for decryption
- All credential access must be logged to audit trail
- Sensitive data must use masked display by default
- Security configurations must be reviewed before production deployment

**Rationale**: Security vulnerabilities can cause catastrophic damage. Security must be built-in from the start, not added as an afterthought.

### VI. Test-Driven Development

**Rule**: Tests MUST be written before implementation and MUST fail before implementation begins.

**Requirements**:
- Write acceptance tests based on spec.md user stories
- Verify tests fail (Red phase)
- Implement feature to make tests pass (Green phase)
- Refactor if needed while keeping tests green
- NO feature implementation without corresponding tests

**Rationale**: TDD ensures requirements are testable, catches bugs early, and creates a safety net for refactoring.

### VII. Japanese-First Documentation & Communication

**Rule**: All documentation files and chat communications MUST be conducted in Japanese.

**Requirements**:
- All .md documentation files must be written in Japanese
- Chat conversations with AI agents must be in Japanese
- Code comments explaining business logic must be in Japanese
- Commit messages should be in Japanese
- PR descriptions and issue discussions must be in Japanese
- Technical specifications (spec.md, plan.md, tasks.md) must be in Japanese
- Use Emoji effectively in a chat 😊

**Exceptions**:
- Code itself (variable names, function names, class names) should follow English naming conventions
- Technical API documentation that references English-only external libraries may use English
- Error messages from external libraries/frameworks remain in their original language

**Rationale**: Maintaining consistent communication in the team's primary language reduces cognitive load, prevents miscommunication, and ensures all team members can fully participate in technical discussions without language barriers.

## User Experience Standards

**PWA Compliance**:
- Application must be installable as Progressive Web App
- Offline functionality for core features (where applicable)
- Responsive design for mobile, tablet, and desktop

**Performance Requirements**:
- 100+ repositories must load without noticeable delay
- Drag & drop operations must feel instant (<100ms response)
- Grid/List view switching must be immediate
- Undo operation must complete in <200ms

**Internationalization**:
- Full support for English and Japanese
- All user-facing text must be externalized for translation
- Date/time formatting must respect user locale

## Deployment & Configuration

**User Task Delegation**:
- Agent MUST explicitly request user action for external service configuration
- Vercel deployment settings require user setup
- Supabase project configuration requires user setup
- OAuth credentials require user provisioning
- Never assume external configuration is complete without user confirmation

**Environment Management**:
- Local development environment must be documented
- Production environment setup must have step-by-step guide
- Environment variables must be clearly documented with examples
- Secrets must never be committed to version control

## Governance

**Amendment Process**:
- Constitution changes require documentation of rationale
- Version must increment following semantic versioning
- All dependent templates must be updated to maintain consistency
- Changes must be approved before implementation

**Compliance Verification**:
- All PRs must verify compliance with constitution principles
- Build pipeline must enforce automated checks (contrast, tests, linting)
- Manual review must verify browser testing was performed
- Security requirements must be validated before production

**Simplicity Principle**:
- Follow YAGNI (You Aren't Gonna Need It)
- Complexity must be justified with clear business value
- Prefer simple, maintainable solutions over clever abstractions
- Remove unused code and dependencies regularly

**Development Workflow**:
- Feature branches for all work
- PR review required before merge
- All tests must pass before merge
- Browser verification screenshots must be included in PR

**Version**: 1.1.0 | **Ratified**: 2025-11-15 | **Last Amended**: 2025-11-15
