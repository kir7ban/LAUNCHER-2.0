# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-page standalone landing page with hero, agent showcase, features, use cases, and CTA sections that serves as the default app entry point.

**Architecture:** New `LandingPage` component renders full-width (no sidebar/header) when `activeView === 'landing'`. App.jsx conditionally hides Sidebar and DashboardHeader. Agent data read from AgentContext.

**Tech Stack:** React 18, plain CSS, existing CSS variables from `src/styles/index.css`

---

### Task 1: Create LandingPage CSS

**Files:**
- Create: `src/styles/LandingPage.css`

- [ ] **Step 1: Write all landing page styles**

Complete CSS file with:
- `.landing-page` — full-width scrollable container
- `.lp-hero` — full viewport height, light gradient background, centered content
- `.lp-section` — shared section padding, max-width 1100px centered
- `.lp-agents-grid` — responsive grid (5 cols → 3 cols → 3 cols compact)
- `.lp-agent-card` — white card with border, hover blue accent
- `.lp-features-grid` — responsive grid (3 cols → 2 cols → 1 col)
- `.lp-feature-card` — white card with icon, title, description
- `.lp-usecases-grid` — responsive grid (3 cols → 2 cols → 1 col)
- `.lp-usecase-card` — card with chat preview bubbles
- `.lp-cta` — blue gradient section, centered content
- `.lp-fade-in` — IntersectionObserver scroll animation class
- Responsive breakpoints at 1024px and 768px
- Uses existing CSS variables: `--accent-primary`, `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--radius-md`, `--shadow-glow`, `--transition-normal`

### Task 2: Create LandingPage Component

**Files:**
- Create: `src/components/LandingPage.jsx`

- [ ] **Step 1: Build the LandingPage component**

Component structure:
- Accepts `onGetStarted` prop (callback to switch to chat view)
- Reads `agents` from `useAgentContext()`
- Uses `useRef` for agents section (smooth scroll target)
- Uses `useEffect` with `IntersectionObserver` for scroll fade-in animations
- Renders 5 sections: Hero, Agent Showcase, Key Features, Use Cases, Final CTA
- Hero "Get Started" and CTA "Launch BDO Genie" both call `onGetStarted`
- Hero "Learn More" scrolls to agents section ref

### Task 3: Integrate Landing Page into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import LandingPage and wire up routing**

Changes:
- Import `LandingPage` component
- Change default `activeView` from `'chat'` to `'landing'`
- When `activeView === 'landing'`, render `<LandingPage>` directly (skip Sidebar, DashboardHeader, content-area wrapper)
- Otherwise render existing layout (sidebar + main content)
- Pass `onGetStarted={() => setActiveView('chat')}` to LandingPage

### Task 4: Verify and fix responsive behavior

**Files:**
- Possibly adjust: `src/styles/LandingPage.css`

- [ ] **Step 1: Run dev server and verify all breakpoints**

Run: `npm run dev`
Verify:
1. App loads to landing page by default
2. All 5 sections render with correct content
3. "Get Started" transitions to chat view with sidebar
4. "Learn More" smooth-scrolls to agents section
5. Desktop (≥1024px), tablet (768-1023px), mobile (<768px) layouts correct
6. Particle background visible behind hero
7. BoschHeader at top, BoschFooter at bottom of landing page
8. No console errors
