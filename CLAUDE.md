# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RBIN BDO Genie** — An orchestrating agent dashboard frontend for Bosch (RBIN BDO). Users send queries through a chatbox and an orchestrator agent delegates to specialized sub-agents (Internet Reimbursement, EzyClaim, EzyCabs, Canteen Services, etc.). Currently a frontend-only React app with simulated/mock agent responses.

## Commands

- `npm run dev` — Start dev server on http://localhost:3000
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build
- No test runner or linter is configured.

## Architecture

**Stack:** React 18 + Vite, plain CSS (no CSS modules, no Tailwind), deployed to Azure Static Web Apps.

**State management:** Single React Context (`AgentContext`) provides all shared state — agents list, conversations, messages, and `sendMessage()`. Currently `sendMessage()` uses `setTimeout` to simulate orchestrator and agent responses. This is the integration point for a real backend.

**Layout structure:**
- `BoschHeader` — Corporate Bosch header with supergraphic, logo, nav links, and agents mega-dropdown. **Do not modify** per user instructions.
- `BoschFooter` — Corporate footer with legal links. **Do not modify** per user instructions.
- `Sidebar` — Left nav (Dashboard/Chat/Agents/Workflows) + recent conversations list. Collapsible.
- `DashboardHeader` — Secondary header showing active view title, search, notifications.
- Main content area switches views via `activeView` state in `App.jsx` (no router library).

**Chat system:**
- `ChatPanel` supports two modes: shared context messages (chat view) and `fresh` mode with isolated local state (used in `DashboardLanding`).
- Messages have three roles: `user`, `orchestrator` (with delegation tracking), and `agent` (with agent identity).
- Input area includes file attachments, voice input (stub), and tools menu (OneDrive/SharePoint/Camera/Screenshot — all stubs).
- Markdown rendering is a custom inline function (`renderMarkdown`), not using the installed `react-markdown` dependency.

**Views:** Routing is manual via `activeView` string state — `dashboard`, `chat`, `agents`, `workflows`. No React Router.

**Background:** `InteractiveBackground` renders a full-screen canvas with drifting particles that react to cursor movement.

## Key Constraints

- The BoschHeader and BoschFooter components implement Bosch corporate design (o-header/o-footer patterns). Do not alter these.
- Custom Bosch font (`BoschSans`) is loaded via `src/styles/bosch-fonts.css`.
- `staticwebapp.config.json` has CSP headers — update if adding external script/API sources.
- Agents are defined as static data in `AgentContext.jsx` (`initialAgents` array). To add/remove agents, edit that array.
- The `WorkflowsPanel` component is defined inline in `App.jsx` with hardcoded workflow data.

## Deployment

Azure Static Web Apps via GitHub Actions. Deployment token stored as `AZURE_STATIC_WEB_APPS_API_TOKEN` secret. CI workflow at `.github/workflows/azure-static-web-apps.yml`.
