# RBIN BDO Genie — Full Frontend Implementation Design

**Date:** 2026-03-25
**Status:** Approved
**Approach:** Incremental Enhancement (keep existing structure, add mock service layer)

## Constraints

- Do not modify `BoschHeader` or `BoschFooter` components
- No real backend — all agent responses are mocked
- Stack: React 18 + Vite, plain CSS, `react-icons` for SVG icons
- Must be swappable to a real API later by replacing the mock service layer

---

## 1. Mock Orchestrator Service Layer

**New file:** `src/services/mockOrchestrator.js`

### Keyword Router

Maps user input to the correct agent via keyword pattern matching:

| Keywords | Agent |
|----------|-------|
| reimbursement, internet bill, broadband | Internet Reimbursement |
| cab, ride, pickup, transport, driver | EzyCabs |
| lunch, menu, canteen, food, cafeteria, meal | Canteen Services |
| ticket, VPN, laptop, IT, helpdesk, wifi | Facility & IT Support |
| onboarding, new joiner, training, joining | Employee Guided Onboarding |
| visitor, gate pass, guest | Visitor Management |
| PF, gratuity, pension, retiral, provident | Retiral Benefits |
| claim, expense, travel expense, receipt | EzyClaim |
| security, compliance, audit, governance, access | Governance & Security |
| Fallback (no match) | Triage Process |

Multiple keyword matches are resolved by specificity (most keywords matched wins). If tied, the first match in priority order wins.

### Conversation Trees

Each agent has a scripted state machine for multi-turn conversations:

```
State Machine Format:
{
  agentId: {
    states: {
      entry: { response: "...", followUp: "question?", nextState: "awaiting_X" },
      awaiting_X: { response: "...", followUp: null, nextState: "done" },
      done: { response: "...", followUp: null, nextState: null }
    }
  }
}
```

Example flows:

**Internet Reimbursement:**
- entry -> "I'll process your internet reimbursement. Which month is this for?"
- month_provided -> "Got it. Please upload your internet bill receipt."
- receipt_uploaded -> "Claim submitted! ID: EC-2025-XX-XXXX. Amount: Rs.1,500. Sent to manager for approval. ETA: 2-3 business days."

**EzyCabs:**
- entry -> "I'll help you book a cab. What's the pickup location and time?"
- details_provided -> "Cab booked! Driver: Rajesh K. Vehicle: MH-12-AB-1234. ETA: 8 minutes. You'll receive an SMS confirmation."

**Canteen Services:**
- entry -> Responds with today's menu (randomized from a set of mock menus). "Would you like to pre-order?"
- preorder -> "Pre-order confirmed for [meal]. Pickup at Counter 3, 12:30 PM."

**Facility & IT Support:**
- entry -> "I'll create a ticket for this. Can you describe the issue in more detail?"
- issue_described -> "Ticket created! ID: IT-2025-XXXX. Priority: [auto-assigned]. Assigned to: [team]. Expected resolution: [SLA time]."

**Employee Guided Onboarding:**
- entry -> "Welcome! I'll guide you through onboarding. What's your employee ID?"
- id_provided -> "Here's your onboarding checklist: [list]. Your buddy is [name]. First training session: [date/time]."

**Visitor Management:**
- entry -> "I'll set up a visitor pass. Visitor name and expected date?"
- details_provided -> "Gate pass generated! Pass ID: VP-XXXX. Host notified. Visitor will receive entry instructions via email."

**Retiral Benefits:**
- entry -> "What would you like to know — PF balance, gratuity estimate, or pension planning?"
- topic_selected -> Responds with relevant mock data (balance, calculator result, or plan options).

**EzyClaim:**
- entry -> "I'll help with your expense claim. What type — travel, meals, or miscellaneous?"
- type_selected -> "Please provide: date, amount, and upload the receipt."
- receipt_provided -> "Claim filed! ID: EX-2025-XXXX. Amount: Rs.X,XXX. Routed to [manager] for approval."

**Governance & Security:**
- entry -> "What do you need — compliance check, access request, or security incident report?"
- topic_selected -> Responds with relevant mock action taken.

**Triage Process (fallback):**
- entry -> "I've analyzed your request and classified it as [category]. Routing to [agent name] for resolution."
- Then hands off to the matched agent's entry state.

### Response Pipeline

Every user message is processed as:

1. **0ms:** User message appears in chat
2. **200ms:** Orchestrator typing indicator appears
3. **800ms:** Orchestrator message with routing plan + delegation cards (all "pending")
4. **800-1200ms:** Delegation cards animate: first card -> "in-progress"
5. **1500ms:** Agent typing indicator appears
6. **2000-2500ms:** Agent response with context-appropriate answer
7. **2500ms:** All delegation cards -> "completed"
8. If conversation tree has follow-up question, agent's response includes it

### Conversation State

```js
{
  conversationId: {
    activeAgent: 'agent-id' | null,
    currentState: 'state-name',
    messages: [...],
    createdAt: timestamp
  }
}
```

Each conversation tracks its own agent and state machine position. New conversations start with no active agent.

---

## 2. Chat Experience Enhancements

### Typing Indicators

- New component: animated three-dot bubble
- Shows agent icon + name above the dots
- Dot pulse animation: 150ms stagger per dot, ease-in-out
- Appears in message flow at the bottom, auto-scrolls

### Delegation Status Animation

Delegation cards in orchestrator messages update sequentially:
- **Pending:** Grey background, `--` icon, muted text
- **In-progress:** Blue/accent background, spinning circle SVG, bold text
- **Completed:** Green background, checkmark SVG, fade-in transition (200ms)
- Transitions happen one at a time with 300-500ms delay between cards

### Markdown Rendering

Replace custom `renderMarkdown` function in `ChatPanel.jsx` with the installed `react-markdown` package. Supports bold, lists, code blocks, links.

### Message Streaming Effect

Agent responses appear with character-by-character reveal:
- Speed: ~10ms per character
- Full message is in state immediately (for accessibility), CSS reveals it progressively
- Can be disabled via `prefers-reduced-motion`

### Conversation Persistence

- `AgentContext` stores messages per conversation: `messagesMap: { [convId]: Message[] }`
- Switching conversations loads the correct message array
- "New Chat" button: creates a new conversation, sets it active, clears chat to welcome screen
- Sidebar conversation title: auto-set to first user message (truncated to ~40 chars)
- New conversations appear at top of sidebar list

### Template Prompts

Suggestion chips trigger the full conversation tree:
- "Claim my internet reimbursement for March" -> routes to Internet Reimbursement, enters conversation tree
- "What is lunch menu for today?" -> routes to Canteen Services
- "Want to Raise a Ticket?" -> routes to Facility & IT Support

---

## 3. Dashboard Landing

Replace current `DashboardLanding` (which just renders `ChatPanel fresh`) with a proper dashboard.

### Layout

```
+------------------------------------------+
| Welcome Banner (glassmorphism card)       |
+----------+----------+----------+---------+
| Agents   | Tasks    | Avg Time | Workflows|
| 8 active | 142 today| 0.7s    | 3 active |
+----------+----------+----------+---------+
| Recent Activity Feed    | Quick Actions   |
| (timeline of agent logs)| (suggestion     |
|                         |  chips -> chat) |
+------------------------------------------+
| Compact Chat Widget (input + welcome)    |
+------------------------------------------+
```

### Welcome Banner
- Glassmorphism card: `backdrop-filter: blur(12px)`, semi-transparent background
- "Welcome back to BDO Genie" heading
- Subtitle: "{active} agents active, {conversations} recent conversations"

### Quick Stats Row
- 4 cards, equal width, glassmorphism style
- Each shows: icon (SVG), value, label
- Values computed from agent data in context

### Recent Activity Feed
- Last 5-6 log entries aggregated from all agents, sorted by time
- Each entry: timestamp, agent icon, agent name, message, status badge (info/success/error)
- Clicking an entry navigates to that agent's detail modal

### Quick Action Chips
- Same prompts as chat template suggestions
- On click: `onNavigate('chat', promptText)` — switches to chat view and sends the message

### Compact Chat Widget
- Shows BDO Genie welcome message + input bar
- On user input: navigates to full chat view with the message sent

---

## 4. Functional Views

### Agents View Enhancements

- **Filter bar:** Horizontal pill buttons — All / Active / Idle / Error. Filters the grid.
- **Search:** Text input that filters agents by name or capability substring match.
- **Card interactions:** `cursor: pointer`, hover: subtle scale(1.01) + box-shadow lift (200ms ease-out). No layout shift.
- **"Send Task" in modal:** Closes modal, navigates to chat view, sends "I need help from [Agent Name]" which routes to that agent.
- **"Pause/Activate Agent":** Toggles `agent.status` between 'active' and 'idle' in context state.
- **"View Full Logs":** Expands the logs section in the modal with 10+ mock log entries (generated on demand).

### Workflows View

Extract `WorkflowsPanel` from `App.jsx` to `src/components/WorkflowsPanel.jsx`.

- **Create workflow:** Button opens a modal with: workflow name input, multi-select agent picker, step editor (add/remove/reorder steps). Saves to local state.
- **Run workflow:** Clicking "Run" starts a simulation — each step transitions through pending -> running -> completed with 1-2s delays. Status badges update in real-time.
- **Workflow detail:** Clicking a workflow card opens an expanded view showing step-by-step progress with agent assignments and time estimates.
- **Edit/Delete:** Edit reopens the create modal pre-filled. Delete removes from state with a confirmation.
- **State:** Add `workflows` and `setWorkflows` to `AgentContext`.

### Search (Header)

- **Implementation:** On input change, search across agents (name, capabilities), conversations (title), workflows (name).
- **Results dropdown:** Positioned below search input, grouped sections: "Agents", "Conversations", "Workflows". Max 3 results per category.
- **Navigation:** Clicking a result sets `activeView` and relevant selection (e.g., opens agent modal, switches to conversation).
- **Close:** Escape key or click outside closes the dropdown.

### Notifications

- **Dropdown:** Positioned below the bell icon. List of mock notifications.
- **Mock data:** Generate 5-8 notifications on mount: "Internet Reimbursement completed claim EC-2025-03-4821", "Workflow 'Customer Support Pipeline' finished successfully", etc.
- **Unread count:** Badge shows count of unread notifications. Clicking a notification marks it read and decrements.
- **"Mark all read":** Button at top of dropdown, resets badge to 0.
- **Navigation:** Clicking a notification navigates to relevant context.

### Agent Detail Modal

- "Send Task" -> closes modal, `setActiveView('chat')`, sends routing message
- "Pause Agent" / "Activate Agent" -> toggles `agent.status`, updates in context
- "View Full Logs" -> generates and shows 15+ mock log entries with varied types (info, success, warning, error)

---

## 5. UI Polish & Accessibility

### SVG Icons

Replace emoji UI chrome with `react-icons` (already installed):
- Sidebar nav: `FiHome`, `FiMessageSquare`, `FiCpu`, `FiGitMerge`, `FiSettings`
- Search: `FiSearch`
- Notifications: `FiBell`
- Close buttons: `FiX`
- Agent emojis stay (they're domain identifiers, not UI chrome)

### Cursor & Hover

- All clickable elements: `cursor: pointer`
- Cards: hover `box-shadow` lift + subtle border color change, `transition: all 200ms ease-out`
- Buttons: hover background darken/lighten, `transition: background-color 200ms ease-out`
- Nav items: hover background highlight

### Loading / Skeleton States

- View transitions show skeleton placeholders (pulsing rectangles matching card layouts)
- Duration: 200-400ms, then real content fades in
- Chat: skeleton for the messages area while conversation loads

### Keyboard Navigation

- Tab order: sidebar -> header -> content area
- Enter activates focused buttons/links
- Escape closes modals, dropdowns, search results
- Arrow keys navigate within dropdowns

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
- Particle background: stop animation loop entirely
- Typing indicator: static "..." text
- Message streaming: instant reveal
- Delegation cards: instant state change

### Responsive Breakpoints

- **Desktop (>1024px):** Full sidebar + content
- **Tablet (768-1024px):** Sidebar collapsed to icons only
- **Mobile (<768px):** Sidebar hidden (hamburger toggle), chat full-width, agent grid single column, modals full-screen

---

## File Changes Summary

### New Files
- `src/services/mockOrchestrator.js` — routing, conversation trees, response pipeline
- `src/components/WorkflowsPanel.jsx` — extracted + enhanced from App.jsx
- `src/components/TypingIndicator.jsx` — animated typing bubble
- `src/components/NotificationsDropdown.jsx` — notification bell dropdown
- `src/components/SearchDropdown.jsx` — header search results
- `src/components/WorkflowCreateModal.jsx` — workflow creation/edit modal
- `src/styles/TypingIndicator.css`
- `src/styles/NotificationsDropdown.css`
- `src/styles/SearchDropdown.css`
- `src/styles/WorkflowCreateModal.css`
- `src/styles/WorkflowsPanel.css` — extracted + enhanced from App.css

### Modified Files
- `src/context/AgentContext.jsx` — conversation persistence, workflows state, notifications state, integrate mock orchestrator
- `src/App.jsx` — remove inline WorkflowsPanel, wire up navigation helpers
- `src/components/ChatPanel.jsx` — typing indicators, react-markdown, streaming effect, conversation persistence
- `src/components/DashboardLanding.jsx` — full dashboard layout with stats/activity/quick actions
- `src/components/DashboardHeader.jsx` — functional search + notifications dropdown
- `src/components/Sidebar.jsx` — SVG icons, new chat button, conversation management
- `src/components/AgentDetailModal.jsx` — functional action buttons
- `src/components/AgentPanel.jsx` — filter bar, search, enhanced interactions
- `src/components/InteractiveBackground.jsx` — reduced motion support
- `src/styles/DashboardLanding.css` — dashboard layout styles
- `src/styles/ChatPanel.css` — typing indicator, streaming, delegation animations
- `src/styles/Sidebar.css` — SVG icon sizing, responsive
- `src/styles/AgentPanel.css` — filter bar, hover states
- `src/styles/AgentDetailModal.css` — functional button states
- `src/styles/App.css` — responsive breakpoints, skeleton styles
- `src/styles/DashboardHeader.css` — search dropdown, notification dropdown positioning
