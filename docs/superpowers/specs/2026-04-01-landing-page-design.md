# Landing Page Design Spec — RBIN BDO Genie

## Context

The app currently launches directly into the chat view with no introduction or overview. Users have no way to understand what BDO Genie does, what agents are available, or how orchestration works before diving in. This landing page serves as both a public-facing marketing page and the entry point into the app.

## Overview

A full-page standalone landing page (no sidebar, no DashboardHeader) that renders as the default view when the app loads. Light mode, responsive across mobile and desktop. Uses the existing animated particle background. "Get Started" transitions into the app shell (sidebar + chat view).

## Sections (scroll order)

### 1. Hero
- Full-viewport height section
- Light gradient background (`#f8fafc → #eef2ff → #f0f9ff`) with animated particle canvas behind it
- "RBIN BDO" label above headline
- Headline: "This is **BDO Genie**" — "BDO Genie" in Bosch blue (#005691)
- Subtitle: "Your one stop solution to everything. Powered by intelligent agents that work together to get things done."
- Two buttons: "Get Started" (primary, solid blue) and "Learn More ↓" (outline, scrolls to agents section)
- "Get Started" sets `activeView` to `'chat'` and hides the landing page

### 2. Agent Showcase
- Heading: "Meet Your Agents"
- Subtitle: "10 specialized agents working together through one intelligent orchestrator"
- Responsive grid of all 10 agents from `initialAgents` in `AgentContext.jsx`
- Each card: emoji icon, agent name, short description
- Cards: white background, subtle border, hover reveals blue border + shadow
- Grid: 5 cols desktop, 3 cols tablet, 3 cols (compact) mobile

### 3. Key Features
- Heading: "Powerful Capabilities"
- Subtitle: "Built for enterprise, designed for simplicity"
- 6 feature cards in a grid:
  1. Multi-Agent Orchestration — "One query, multiple agents collaborating to deliver comprehensive answers."
  2. Real-Time Responses — "Average response under 1 second. See delegation in real time."
  3. File Attachments — "Upload documents, receipts, files. Agents extract what they need."
  4. Workflow Automation — "Chain agents into automated workflows for multi-step processes."
  5. Enterprise Security — "Governance compliance, access control, and audit trails."
  6. Dark & Light Themes — "Full theme support. Easy on the eyes, day or night."
- Grid: 3 cols desktop, 2 cols tablet, stacked horizontal cards on mobile

### 4. Use Cases
- Heading: "See It In Action"
- Subtitle: "Real conversations, real results"
- 3 cards, each with a mini chat preview (user bubble + agent bubble):
  1. Internet Reimbursement — "Claim my internet reimbursement for March" → agent processes
  2. Cab Booking — "Book a cab to office tomorrow 9 AM" → confirmed with fare
  3. Canteen Menu — "What's on the canteen menu today?" → today's menu items
- Grid: 3 cols desktop, 2 cols tablet (last card full-width), 1 col mobile

### 5. Final CTA
- Blue gradient background (`#005691 → #008ecf`)
- "Ready to get started?"
- Subtitle + "Launch BDO Genie →" button (white on blue)
- Button triggers same action as hero "Get Started"

### 6. Footer
- Existing BoschFooter component renders at the bottom

## Architecture

### New files
- `src/components/LandingPage.jsx` — the full landing page component
- `src/styles/LandingPage.css` — all landing page styles

### Modified files
- `src/App.jsx` — add `'landing'` as the default `activeView`, render `<LandingPage />` when active. When landing is active, hide Sidebar and DashboardHeader (full-page standalone). BoschHeader remains visible at the top. Sidebar's nav should include a "Home" option that navigates back to the landing page.

### No changes to
- `BoschHeader.jsx` / `BoschFooter.jsx` — untouched per constraint
- `InteractiveBackground.jsx` — already renders behind everything, works as-is
- `AgentContext.jsx` — agent data consumed read-only
- `Sidebar.jsx` — hidden when landing is active, no code changes needed (controlled by App.jsx)

## Layout when landing is active

```
┌─────────────────────────────────────────┐
│           BoschHeader (sticky)          │
├─────────────────────────────────────────┤
│                                         │
│  InteractiveBackground (particles)      │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │         LandingPage               │  │
│  │  (full-width, scrollable)         │  │
│  │  Hero → Agents → Features →      │  │
│  │  Use Cases → CTA                 │  │
│  └───────────────────────────────────┘  │
│                                         │
│           BoschFooter                   │
└─────────────────────────────────────────┘
```

No sidebar. No DashboardHeader. Content area takes full width.

## Visual Style

- **Light mode default** — white/off-white backgrounds, Bosch blue accents
- **Theme-aware** — respects `data-theme` attribute for dark mode via existing CSS variables
- **Typography** — BoschSans font (already loaded globally)
- **Cards** — white bg, `1px solid var(--border-primary)` border, `var(--radius-md)` corners, hover: blue border + `var(--shadow-glow)`
- **Buttons** — primary: `var(--accent-primary)` bg, white text. Outline: transparent bg, blue border/text
- **Spacing** — uses existing spacing variables from `index.css`

## Responsive Breakpoints

| Breakpoint | Agent Grid | Features | Use Cases | Hero Buttons |
|---|---|---|---|---|
| Desktop (≥1024px) | 5 cols | 3 cols | 3 cols | inline row |
| Tablet (768-1023px) | 3 cols | 2 cols | 2 cols | inline row |
| Mobile (<768px) | 3 cols compact | 1 col stacked | 1 col stacked | full-width stacked |

- Max content width: 1100px, centered with auto margins
- Padding: 3rem horizontal on desktop, 1.5rem on tablet, 1rem on mobile
- Hero section: full viewport height on desktop, auto height on mobile

## Interactions

- **"Get Started" / "Launch BDO Genie"** — calls `onViewChange('chat')` or sets `activeView` to `'chat'`, which shows the sidebar + chat view
- **"Learn More ↓"** — smooth scrolls to the agent showcase section (`scrollIntoView({ behavior: 'smooth' })`)
- **Agent cards** — hover effect only (no click action on landing page)
- **Scroll animations** — sections fade in on scroll using `IntersectionObserver` (subtle, not heavy)

## Data Source

Agent showcase reads from `AgentContext` (`useAgents()` hook) to get the `agents` array. This ensures the landing page always reflects the current agent list without hardcoding.

## Verification

1. `npm run dev` — app loads to landing page by default
2. All 5 sections render correctly with proper content
3. "Get Started" transitions to chat view with sidebar
4. "Learn More" smooth-scrolls to agents section
5. Resize browser — verify all 3 breakpoints (desktop/tablet/mobile)
6. Toggle dark mode — verify theme-aware styling
7. Particle background visible behind hero section
8. BoschHeader visible at top, BoschFooter at bottom
9. No console errors
