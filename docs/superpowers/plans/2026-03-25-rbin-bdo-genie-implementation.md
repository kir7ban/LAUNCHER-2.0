# RBIN BDO Genie Full Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully implement the RBIN BDO Genie agentic chatbot dashboard with smart mock routing, multi-turn conversation trees, functional views, and polished UI.

**Architecture:** Incremental enhancement of the existing React 18 + Vite app. A new mock orchestrator service layer handles routing/conversation intelligence. AgentContext is refactored for per-conversation message storage and a `pendingMessage` pattern for navigation-with-message. All existing components are enhanced in-place.

**Tech Stack:** React 18, Vite, plain CSS (CSS custom properties), react-icons (Feather icons), react-markdown

**Spec:** `docs/superpowers/specs/2026-03-25-rbin-bdo-genie-full-implementation-design.md`

**Constraints:**
- Do NOT modify `BoschHeader.jsx`, `BoschHeader.css`, `BoschFooter.jsx`, or `BoschFooter.css`
- No test runner is configured; verify each task by running `npm run dev` and checking in browser
- Run `npm install` before starting (node_modules may not exist)

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/services/mockOrchestrator.js` | Keyword router, conversation tree state machines, response pipeline with timing, message queue |
| `src/components/TypingIndicator.jsx` | Animated three-dot typing bubble with agent identity |
| `src/styles/TypingIndicator.css` | Typing indicator animations |
| `src/components/WorkflowsPanel.jsx` | Extracted workflows view with CRUD, run simulation |
| `src/components/WorkflowCreateModal.jsx` | Modal for creating/editing workflows |
| `src/styles/WorkflowsPanel.css` | Workflows view styles (extract from App.css) |
| `src/styles/WorkflowCreateModal.css` | Workflow modal styles |
| `src/components/SearchDropdown.jsx` | Header search results dropdown |
| `src/styles/SearchDropdown.css` | Search dropdown styles |
| `src/components/NotificationsDropdown.jsx` | Notification bell dropdown |
| `src/styles/NotificationsDropdown.css` | Notification dropdown styles |

### Modified Files
| File | Changes |
|------|---------|
| `src/context/AgentContext.jsx` | `messagesMap`, `pendingMessage`, `setConversations`, `createConversation`, workflows state, notifications state, integrate mock orchestrator |
| `src/components/ChatPanel.jsx` | Typing indicators, `react-markdown`, streaming effect, delegation animations, `pendingMessage` consumption |
| `src/components/Sidebar.jsx` | SVG icons via `react-icons`, "New Chat" button, conversation delete |
| `src/components/DashboardLanding.jsx` | Full dashboard: welcome banner, stats, activity feed, quick actions, compact chat |
| `src/components/DashboardHeader.jsx` | Functional search with `SearchDropdown`, notifications with `NotificationsDropdown` |
| `src/components/AgentPanel.jsx` | Filter bar, search input, enhanced card styles |
| `src/components/AgentDetailModal.jsx` | Functional "Send Task", "Pause/Activate", "View Full Logs" |
| `src/components/InteractiveBackground.jsx` | `prefers-reduced-motion` support |
| `src/App.jsx` | Replace inline agents grid with `<AgentPanel>`, replace inline `WorkflowsPanel` with extracted component, pass `onNavigateToChat` to modal |
| `src/styles/ChatPanel.css` | Typing indicator placement, delegation animation keyframes, streaming reveal |
| `src/styles/Sidebar.css` | SVG icon sizing, new chat button |
| `src/styles/DashboardLanding.css` | Already has most styles; minor additions for compact chat widget |
| `src/styles/AgentPanel.css` | Filter bar, search input, hover enhancements |
| `src/styles/AgentDetailModal.css` | Active button states |
| `src/styles/App.css` | Remove workflow styles (extracted), add responsive breakpoints |
| `src/styles/InteractiveBackground.css` | *(no CSS changes — reduced motion handled via JS in the component)* |
| `src/styles/index.css` | Global reduced motion rule |

---

## Task 1: Setup and Install Dependencies

**Files:**
- Verify: `package.json`

- [ ] **Step 1: Install npm dependencies**

```bash
cd /Users/home/LAUNCHER-2.0 && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 2: Verify dev server starts**

```bash
cd /Users/home/LAUNCHER-2.0 && npm run dev
```

Expected: Vite dev server starts at http://localhost:3000, existing app loads.

- [ ] **Step 3: Commit**

No changes to commit, just verification.

---

## Task 2: Mock Orchestrator Service Layer

**Files:**
- Create: `src/services/mockOrchestrator.js`

This is the intelligence layer. No UI — pure logic.

- [ ] **Step 1: Create the keyword router**

Create `src/services/mockOrchestrator.js` with the keyword-to-agent mapping and `routeMessage(text)` function that returns the matched agent ID. Case-insensitive matching. Returns the agent with the most keyword hits; falls back to `triage-process`.

```js
// Keyword map: each entry is [agentId, [...keywords]]
const KEYWORD_MAP = [
  ['internet-reimbursement', ['reimbursement', 'internet bill', 'broadband', 'internet']],
  ['ezycabs', ['cab', 'ride', 'pickup', 'transport', 'driver', 'taxi']],
  ['canteen-services', ['lunch', 'menu', 'canteen', 'food', 'cafeteria', 'meal', 'breakfast', 'dinner']],
  ['facility-it-support', ['ticket', 'vpn', 'laptop', 'helpdesk', 'wifi', 'printer', 'it support', 'it issue']],
  ['employee-onboarding', ['onboarding', 'new joiner', 'training', 'joining', 'induction']],
  ['visitor-management', ['visitor', 'gate pass', 'guest', 'visit']],
  ['retiral-benefits', ['pf', 'gratuity', 'pension', 'retiral', 'provident', 'retirement']],
  ['ezyclaim', ['claim', 'expense', 'travel expense', 'receipt', 'expense claim']],
  ['governance-security', ['security', 'compliance', 'audit', 'governance', 'access control']],
];

export function routeMessage(text) {
  const lower = text.toLowerCase();
  let bestAgent = null;
  let bestScore = 0;

  for (const [agentId, keywords] of KEYWORD_MAP) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agentId;
    }
  }

  return bestAgent || 'triage-process';
}
```

- [ ] **Step 2: Create conversation tree state machines**

Add the `CONVERSATION_TREES` object mapping each agent ID to its state machine. Each state has: `response` (string with markdown), `followUp` (optional question string appended to response), `nextState` (string or null). Also add helper `getAgentMeta(agentId)` that returns `{ name, icon }` from the agent data.

Use functions (not static strings) for responses that contain dynamic data like claim IDs:

```js
// Helper for dynamic IDs
const randomId = (prefix) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

const CONVERSATION_TREES = {
  'internet-reimbursement': {
    entry: {
      response: () => "I'll process your internet reimbursement. **Which month** is this for?",
      nextState: 'month_provided',
    },
    month_provided: {
      response: () => "Got it. Please **upload your internet bill receipt** using the attachment button below.",
      nextState: 'receipt_uploaded',
    },
    receipt_uploaded: {
      response: () => `**Claim submitted!**\n\n- **Claim ID:** ${randomId('EC-2025-03')}\n- **Amount:** Rs.1,500\n- **Status:** Sent to manager for approval\n\nExpected processing time: 2-3 business days.`,
      nextState: null,
    },
  },
  'triage-process': {
    entry: {
      response: (content) => {
        // Secondary keyword scan to find best-guess agent
        const secondaryMatch = routeMessage(content);
        if (secondaryMatch !== 'triage-process') {
          return `I've analyzed your request and classified it. Routing to the appropriate agent for resolution.`;
        }
        return "I wasn't able to route your request. Could you rephrase or try one of these options?";
      },
      nextState: null,
      // Special: triggers hand-off (see processMessage below)
      handOff: true,
    },
  },
  // ... (all other 8 agents with 2-3 states each, per spec)
  // Each response field is a function: () => "string" or (content) => "string"
};
```

Include all 10 agent trees as specified in the design spec. Every `response` must be a **function** `() => string` (not a static string) so dynamic IDs are generated per invocation.

- [ ] **Step 3: Create the response pipeline**

Add `processMessage(content, conversationState)` that returns a sequence of timed actions:

```js
// Returns: { orchestratorMsg, agentMsg, delegations, updatedState, triageHandOff? }
export function processMessage(content, convState, agents) {
  let targetAgentId = convState.activeAgent || routeMessage(content);
  const isTriage = targetAgentId === 'triage-process' && !convState.activeAgent;

  // Triage hand-off: if triage matched, do secondary scan and hand off to real agent
  let handOffAgentId = null;
  if (isTriage) {
    // Re-run routing with looser matching or default to facility-it-support
    handOffAgentId = 'facility-it-support';
    // Try to find any partial keyword match
    for (const [agentId, keywords] of KEYWORD_MAP) {
      if (agentId !== 'triage-process') {
        const lower = content.toLowerCase();
        if (keywords.some(kw => lower.includes(kw.substring(0, 3)))) {
          handOffAgentId = agentId;
          break;
        }
      }
    }
  }

  const effectiveAgentId = isTriage ? handOffAgentId : targetAgentId;
  const agent = agents.find(a => a.id === effectiveAgentId);
  const tree = CONVERSATION_TREES[effectiveAgentId];
  const currentState = convState.currentState || 'entry';
  const stateNode = tree?.[currentState] || tree?.entry;

  const delegations = [
    { agent: 'Triage Process', task: 'Classify & route request', status: 'pending' },
    { agent: agent?.name || 'Unknown', task: 'Process request', status: 'pending' },
  ];

  let orchestratorContent;
  if (targetAgentId === convState.activeAgent) {
    orchestratorContent = `Continuing with **${agent?.name}**...`;
  } else if (isTriage) {
    orchestratorContent = `I've analyzed your request and classified it. Connecting you with **${agent?.name}**...`;
  } else {
    orchestratorContent = `I'm analyzing your request and routing it to the right agents...\n\n**${agent?.name}** will handle this.`;
  }

  // Call response function (not static string)
  const responseContent = typeof stateNode?.response === 'function'
    ? stateNode.response(content)
    : stateNode?.response || "I've received your request and I'm processing it now.";
  const nextState = stateNode?.nextState || null;

  return {
    targetAgentId: effectiveAgentId,
    orchestratorMsg: { content: orchestratorContent, delegations },
    agentMsg: {
      content: responseContent,
      agentId: effectiveAgentId,
      agentName: agent?.name || 'Agent',
      agentIcon: agent?.icon || '🤖',
    },
    updatedState: {
      activeAgent: nextState ? effectiveAgentId : null,
      currentState: nextState,
    },
  };
}
```

- [ ] **Step 4: Add message queue for in-flight handling**

Add a `MessageQueue` class that ensures responses never interleave:

```js
export class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  enqueue(pipeline) {
    return new Promise((resolve) => {
      this.queue.push({ pipeline, resolve });
      this._processNext();
    });
  }

  async _processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const { pipeline, resolve } = this.queue.shift();
    await pipeline();
    this.processing = false;
    resolve();
    this._processNext();
  }
}
```

- [ ] **Step 5: Add ID generation utility**

```js
let _msgId = 100;
export function generateMsgId() {
  return `msg-${Date.now()}-${_msgId++}`;
}
```

- [ ] **Step 6: Verify the module exports**

Ensure the file exports: `routeMessage`, `processMessage`, `MessageQueue`, `generateMsgId`, `CONVERSATION_TREES`.

- [ ] **Step 7: Commit**

```bash
git add src/services/mockOrchestrator.js
git commit -m "feat: add mock orchestrator service with keyword routing and conversation trees"
```

---

## Task 3: Refactor AgentContext for Conversation Persistence

**Files:**
- Modify: `src/context/AgentContext.jsx`

- [ ] **Step 1: Replace flat messages with messagesMap**

Replace `const [messages, setMessages] = useState([...initialMessages])` with:

```js
const [messagesMap, setMessagesMap] = useState({
  'conv-1': [...initialMessages],  // existing hardcoded messages
});
```

Derive active messages:
```js
const messages = messagesMap[activeConversation] || [];
```

- [ ] **Step 2: Add pendingMessage state**

```js
const [pendingMessage, setPendingMessage] = useState(null);
```

- [ ] **Step 3: Add workflows and notifications state**

```js
const initialWorkflows = [
  { id: 1, name: 'Customer Support Pipeline', steps: 4, status: 'active', lastRun: '2 min ago', agents: ['Triage Process', 'EzyClaim', 'Facility & IT Support'] },
  { id: 2, name: 'Expense Processing Flow', steps: 3, status: 'idle', lastRun: '1 hr ago', agents: ['EzyClaim', 'Internet Reimbursement'] },
  { id: 3, name: 'Employee Onboarding', steps: 5, status: 'active', lastRun: '5 min ago', agents: ['Employee Guided Onboarding', 'Facility & IT Support', 'Governance & Security'] },
  { id: 4, name: 'Visitor Check-In', steps: 3, status: 'error', lastRun: '30 min ago', agents: ['Visitor Management', 'Governance & Security'] },
];

const initialNotifications = [
  { id: 'n1', text: 'Internet Reimbursement completed claim EC-2025-03-4821', read: false, time: '10:32 AM', agentId: 'internet-reimbursement' },
  { id: 'n2', text: "Workflow 'Customer Support Pipeline' finished successfully", read: false, time: '10:28 AM', type: 'workflow' },
  { id: 'n3', text: 'EzyCabs: Driver assigned for your 3 PM pickup', read: false, time: '10:15 AM', agentId: 'ezycabs' },
  { id: 'n4', text: 'Facility & IT Support resolved ticket IT-2025-4521', read: true, time: '10:05 AM', agentId: 'facility-it-support' },
  { id: 'n5', text: 'Canteen Services: 45 meal pre-orders confirmed', read: true, time: '10:00 AM', agentId: 'canteen-services' },
  { id: 'n6', text: 'Employee Onboarding: 3 new joiners starting today', read: false, time: '9:00 AM', agentId: 'employee-onboarding' },
];

const [workflows, setWorkflows] = useState(initialWorkflows);
const [notifications, setNotifications] = useState(initialNotifications);
```

- [ ] **Step 4: Add conversationStates for tracking agent/state per conversation**

```js
const [conversationStates, setConversationStates] = useState({});
// Shape: { [convId]: { activeAgent: string|null, currentState: string|null } }
```

- [ ] **Step 5: Add createConversation helper**

```js
const createConversation = (title) => {
  const id = 'conv-' + Date.now();
  const newConv = {
    id,
    title: title || 'New Conversation',
    timestamp: 'Just now',
    preview: '',
  };
  setConversations(prev => [newConv, ...prev]);
  setActiveConversation(id);
  setMessagesMap(prev => ({ ...prev, [id]: [] }));
  return id;
};
```

- [ ] **Step 6: Rewrite sendMessage to use mock orchestrator**

Import `processMessage`, `MessageQueue`, `generateMsgId` from `../services/mockOrchestrator`. Create a single `messageQueue` ref. **Use refs for `activeConversation` and `conversationStates`** to avoid stale closures in the async pipeline:

```js
const messageQueueRef = useRef(new MessageQueue());
const activeConversationRef = useRef(activeConversation);
const conversationStatesRef = useRef(conversationStates);

// Keep refs in sync
useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
useEffect(() => { conversationStatesRef.current = conversationStates; }, [conversationStates]);

const addMessage = (convId, msg) => {
  setMessagesMap(prev => ({
    ...prev,
    [convId]: [...(prev[convId] || []), msg],
  }));
};

const sendMessage = (content) => {
  // Read from refs to avoid stale closures
  const convId = activeConversationRef.current;
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // User message
  const userMsg = { id: generateMsgId(), role: 'user', content, timestamp: ts };
  addMessage(convId, userMsg);

  // Update conversation title if first message
  setConversations(prev => prev.map(c =>
    c.id === convId && c.title === 'New Conversation'
      ? { ...c, title: content.length > 40 ? content.substring(0, content.lastIndexOf(' ', 40)) + '...' : content, preview: content.substring(0, 40) }
      : c
  ));

  // Process through mock orchestrator — read from ref for latest state
  const convState = conversationStatesRef.current[convId] || { activeAgent: null, currentState: null };
  const result = processMessage(content, convState, agents);

  // Update conversation state
  setConversationStates(prev => ({ ...prev, [convId]: result.updatedState }));

  // Queue the response pipeline
  messageQueueRef.current.enqueue(() => new Promise((resolve) => {
    // Show typing indicator
    addMessage(convId, { id: generateMsgId(), role: 'typing', agentName: 'Orchestrator', agentIcon: '🎯', timestamp: ts });

    setTimeout(() => {
      // Remove typing, add orchestrator message
      setMessagesMap(prev => ({
        ...prev,
        [convId]: prev[convId].filter(m => m.role !== 'typing').concat({
          id: generateMsgId(),
          role: 'orchestrator',
          content: result.orchestratorMsg.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          agentId: 'orchestrator',
          delegations: result.orchestratorMsg.delegations.map(d => ({ ...d })),
        }),
      }));

      // Update delegations to in-progress
      setTimeout(() => {
        setMessagesMap(prev => ({
          ...prev,
          [convId]: prev[convId].map(m =>
            m.role === 'orchestrator' && m.delegations
              ? { ...m, delegations: m.delegations.map((d, i) => i === 0 ? { ...d, status: 'in-progress' } : d) }
              : m
          ),
        }));
      }, 200);

      // Agent typing indicator
      setTimeout(() => {
        addMessage(convId, { id: generateMsgId(), role: 'typing', agentName: result.agentMsg.agentName, agentIcon: result.agentMsg.agentIcon });
      }, 700);

      // Agent response + complete delegations
      setTimeout(() => {
        setMessagesMap(prev => ({
          ...prev,
          [convId]: prev[convId]
            .filter(m => m.role !== 'typing')
            .map(m =>
              m.role === 'orchestrator' && m.delegations
                ? { ...m, delegations: m.delegations.map(d => ({ ...d, status: 'completed' })) }
                : m
            )
            .concat({
              id: generateMsgId(),
              role: 'agent',
              content: result.agentMsg.content,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              agentId: result.agentMsg.agentId,
              agentName: result.agentMsg.agentName,
              agentIcon: result.agentMsg.agentIcon,
            }),
        }));
        resolve();
      }, 1400);
    }, 800);
  }));
};
```

- [ ] **Step 7: Update the context provider value**

Expose all new state and helpers:

```js
<AgentContext.Provider value={{
  agents, setAgents,
  conversations, setConversations,
  activeConversation, setActiveConversation,
  messages,  // derived from messagesMap
  sendMessage,
  createConversation,
  workflows, setWorkflows,
  notifications, setNotifications,
  pendingMessage, setPendingMessage,
}}>
```

- [ ] **Step 8: Verify — run dev server**

```bash
npm run dev
```

Open http://localhost:3000. The existing chat should still work. Sending a message should show orchestrator typing -> orchestrator response -> agent typing -> agent response with correct routing.

- [ ] **Step 9: Commit**

```bash
git add src/context/AgentContext.jsx src/services/mockOrchestrator.js
git commit -m "feat: refactor AgentContext with conversation persistence and mock orchestrator integration"
```

---

## Task 4: Typing Indicator Component

**Files:**
- Create: `src/components/TypingIndicator.jsx`
- Create: `src/styles/TypingIndicator.css`

- [ ] **Step 1: Create TypingIndicator component**

```jsx
import React from 'react';
import '../styles/TypingIndicator.css';

export default function TypingIndicator({ agentName, agentIcon }) {
  return (
    <div className="typing-indicator-wrapper">
      <div className="typing-indicator-bubble">
        <div className="typing-indicator-header">
          <span className="typing-indicator-icon">{agentIcon}</span>
          <span className="typing-indicator-name">{agentName}</span>
        </div>
        <div className="typing-dots">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TypingIndicator styles**

```css
.typing-indicator-wrapper {
  align-self: flex-start;
  max-width: 85%;
}

.typing-indicator-bubble {
  padding: 12px 18px;
  border-radius: 18px;
  border-bottom-left-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}

.typing-indicator-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.typing-indicator-icon {
  font-size: 0.9rem;
}

.typing-indicator-name {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-muted);
}

.typing-dots {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 20px;
}

.typing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: typingPulse 1.4s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typingPulse {
  0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
  30% { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .typing-dot {
    animation: none;
    opacity: 0.6;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TypingIndicator.jsx src/styles/TypingIndicator.css
git commit -m "feat: add TypingIndicator component with animated dots"
```

---

## Task 5: Enhance ChatPanel

**Files:**
- Modify: `src/components/ChatPanel.jsx`
- Modify: `src/styles/ChatPanel.css`

- [ ] **Step 1: Add TypingIndicator and react-markdown imports**

At the top of `ChatPanel.jsx`, add:
```js
import ReactMarkdown from 'react-markdown';
import TypingIndicator from './TypingIndicator';
```

- [ ] **Step 2: Add pendingMessage consumption**

After the existing `useEffect` for scrolling, add:

```js
const { pendingMessage, setPendingMessage } = fresh ? {} : ctx;

useEffect(() => {
  if (!fresh && pendingMessage) {
    sendMessage(pendingMessage);
    setPendingMessage(null);
  }
}, [pendingMessage]);
```

Update the destructuring at the top to pull `pendingMessage` and `setPendingMessage` from context when not in fresh mode.

- [ ] **Step 3: Replace renderMarkdown with ReactMarkdown**

Delete the `renderMarkdown` function at the bottom of the file. Replace all `{renderMarkdown(msg.content)}` calls in the JSX with:

```jsx
<ReactMarkdown>{msg.content}</ReactMarkdown>
```

- [ ] **Step 4: Add typing indicator rendering in message loop**

In the messages map, add a case for `msg.role === 'typing'`:

```jsx
{msg.role === 'typing' && (
  <TypingIndicator agentName={msg.agentName} agentIcon={msg.agentIcon} />
)}
```

- [ ] **Step 5: Add delegation card animation styles**

In `ChatPanel.css`, add:

```css
/* Delegation animation states */
.delegation-item {
  transition: all 0.3s ease-out;
}

.delegation-pending {
  opacity: 0.6;
}

.delegation-in-progress .delegation-status-icon {
  display: inline-block;
  animation: delegationSpin 1s linear infinite;
}

@keyframes delegationSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.delegation-completed {
  animation: delegationFadeIn 0.3s ease-out;
}

@keyframes delegationFadeIn {
  from { opacity: 0.5; }
  to { opacity: 1; }
}
```

- [ ] **Step 6: Update delegation status icons to SVG**

Replace the emoji status icons in the delegation rendering:

```jsx
<span className="delegation-status-icon">
  {d.status === 'completed' && (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  )}
  {d.status === 'in-progress' && (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
  )}
  {d.status === 'pending' && (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="15"/></svg>
  )}
</span>
```

- [ ] **Step 7: Update fresh mode for dashboard integration**

Update the fresh mode `sendMessage` to call `ctx.createConversation` and `ctx.setPendingMessage` when available, then signal navigation:

```js
const sendMessageFresh = (content) => {
  if (onFreshSubmit) {
    onFreshSubmit(content);
  }
};
```

Add `onFreshSubmit` prop to ChatPanel. The dashboard will pass a callback that creates a conversation and navigates.

- [ ] **Step 8: Add message streaming effect**

Add a `StreamingText` wrapper component inline in `ChatPanel.jsx` that reveals agent message text character by character:

```jsx
function StreamingText({ text, speed = 10 }) {
  const [displayed, setDisplayed] = useState('');
  const prefersReduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (prefersReduced.current) {
      setDisplayed(text);
      return;
    }
    let i = 0;
    setDisplayed('');
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <ReactMarkdown>{displayed}</ReactMarkdown>;
}
```

Use `<StreamingText text={msg.content} />` for `msg.role === 'agent'` messages only. Orchestrator messages render instantly with `<ReactMarkdown>`.

- [ ] **Step 9: Verify**

```bash
npm run dev
```

Send a message in chat. Should see: typing indicator -> orchestrator response with delegation cards -> typing indicator -> agent response with streaming text reveal. Markdown should render correctly with bold, lists.

- [ ] **Step 10: Commit**

```bash
git add src/components/ChatPanel.jsx src/styles/ChatPanel.css
git commit -m "feat: enhance ChatPanel with typing indicators, react-markdown, streaming text, and delegation animations"
```

---

## Task 6: Enhance Sidebar with SVG Icons and Conversation Management

**Files:**
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/styles/Sidebar.css`

- [ ] **Step 1: Replace emoji nav icons with react-icons**

```jsx
import { FiHome, FiMessageSquare, FiCpu, FiGitMerge, FiSettings, FiPlus, FiTrash2 } from 'react-icons/fi';

const navItems = [
  { id: 'dashboard', icon: <FiHome size={18} />, label: 'Dashboard' },
  { id: 'chat', icon: <FiMessageSquare size={18} />, label: 'Chat' },
  { id: 'agents', icon: <FiCpu size={18} />, label: 'Agents' },
  { id: 'workflows', icon: <FiGitMerge size={18} />, label: 'Workflows' },
];
```

Update the nav rendering to use `item.icon` directly (JSX element) instead of wrapping in a span.

- [ ] **Step 2: Add "New Chat" button**

Replace the `+` text button in conversation list header with:

```jsx
<button className="btn-icon" title="New chat" onClick={handleNewChat}>
  <FiPlus size={16} />
</button>
```

Add `handleNewChat`:
```js
const { createConversation } = useAgentContext();

const handleNewChat = () => {
  createConversation('New Conversation');
  onViewChange('chat');
};
```

- [ ] **Step 3: Add conversation delete on hover**

Add a delete button that appears on hover for each conversation item:

```jsx
<div className="conversation-item" ...>
  <div className="conv-title">{conv.title}</div>
  <div className="conv-meta">{conv.timestamp}</div>
  <button
    className="conv-delete-btn"
    onClick={(e) => { e.stopPropagation(); handleDeleteConv(conv.id); }}
    title="Delete conversation"
  >
    <FiTrash2 size={12} />
  </button>
</div>
```

```js
const handleDeleteConv = (convId) => {
  setConversations(prev => prev.filter(c => c.id !== convId));
  if (activeConversation === convId && conversations.length > 1) {
    const remaining = conversations.filter(c => c.id !== convId);
    setActiveConversation(remaining[0]?.id);
  }
};
```

Pull `setConversations` from context.

- [ ] **Step 4: Update Sidebar.css**

Add SVG icon alignment and delete button styles:

```css
.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.conversation-item {
  position: relative;
}

.conv-delete-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast);
  padding: 4px;
  border-radius: 4px;
}

.conversation-item:hover .conv-delete-btn {
  opacity: 1;
}

.conv-delete-btn:hover {
  color: var(--danger);
  background: var(--danger-bg);
}
```

Also replace the Settings emoji in the footer with `<FiSettings size={18} />`.

- [ ] **Step 5: Verify**

Nav icons should be SVG Feather icons. "New Chat" should create a new empty conversation. Delete button appears on hover.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.jsx src/styles/Sidebar.css
git commit -m "feat: sidebar SVG icons, new chat button, conversation delete"
```

---

## Task 7: Full Dashboard Landing

**Files:**
- Modify: `src/components/DashboardLanding.jsx`
- Modify: `src/styles/DashboardLanding.css`

- [ ] **Step 1: Rewrite DashboardLanding with full layout**

Replace the current single `<ChatPanel fresh />` with the full dashboard:

```jsx
import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import { FiUsers, FiCheckCircle, FiClock, FiGitMerge } from 'react-icons/fi';
import ChatPanel from './ChatPanel';
import '../styles/DashboardLanding.css';

export default function DashboardLanding({ onNavigate, onSelectAgent }) {
  const { agents, conversations, workflows, createConversation, setPendingMessage } = useAgentContext();
  const activeAgents = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);
  const avgTime = (agents.reduce((sum, a) => sum + parseFloat(a.avgResponseTime), 0) / agents.length).toFixed(1) + 's';
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;

  // Aggregate recent activity from agent logs
  const recentActivity = agents
    .flatMap(a => a.logs.map(log => ({ ...log, agentName: a.name, agentIcon: a.icon, agentId: a.id })))
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 6);

  const quickActions = [
    { icon: '🌐', text: 'Claim my internet reimbursement for March' },
    { icon: '🍽️', text: "What is lunch menu for today?" },
    { icon: '🎫', text: 'Want to Raise a Ticket?' },
  ];

  const handleQuickAction = (text) => {
    const convId = createConversation(text.length > 40 ? text.substring(0, text.lastIndexOf(' ', 40)) + '...' : text);
    setPendingMessage(text);
    onNavigate('chat');
  };

  const handleFreshSubmit = (content) => {
    const convId = createConversation(content.length > 40 ? content.substring(0, content.lastIndexOf(' ', 40)) + '...' : content);
    setPendingMessage(content);
    onNavigate('chat');
  };

  return (
    <div className="dashboard-landing">
      {/* Welcome Banner */}
      <div className="dl-welcome-banner">
        <h1 className="dl-welcome-title">Welcome back to <span className="genie-brand">BDO Genie</span></h1>
        <p className="dl-welcome-sub">{activeAgents} agents active, {conversations.length} recent conversations</p>
      </div>

      {/* Stats Row */}
      <div className="dl-kpis">
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--agents"><FiUsers size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{activeAgents}/{agents.length}</span>
            <span className="dl-kpi-label">Agents Active</span>
          </div>
        </div>
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--tasks"><FiCheckCircle size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{totalTasks.toLocaleString()}</span>
            <span className="dl-kpi-label">Tasks Completed</span>
          </div>
        </div>
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--active"><FiClock size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{avgTime}</span>
            <span className="dl-kpi-label">Avg Response Time</span>
          </div>
        </div>
        <div className="dl-kpi-card">
          <div className="dl-kpi-icon dl-kpi-icon--success"><FiGitMerge size={20} /></div>
          <div className="dl-kpi-data">
            <span className="dl-kpi-value">{activeWorkflows}</span>
            <span className="dl-kpi-label">Active Workflows</span>
          </div>
        </div>
      </div>

      {/* Activity + Quick Actions row */}
      <div className="dl-columns">
        <div>
          <div className="dl-section__header">
            <h2 className="dl-section__title">Recent Activity</h2>
          </div>
          <div className="dl-activity-list">
            {recentActivity.map((item, i) => (
              <div key={i} className="dl-activity-item" onClick={() => {
                const agent = agents.find(a => a.id === item.agentId);
                if (agent && onSelectAgent) onSelectAgent(agent);
              }} style={{ cursor: 'pointer' }}>
                <span className="dl-activity-item__icon">{item.agentIcon}</span>
                <div className="dl-activity-item__content">
                  <span className="dl-activity-item__agent">{item.agentName}</span>
                  <span className="dl-activity-item__action">{item.message}</span>
                </div>
                <div className={`dl-activity-item__dot dl-activity-item__dot--${item.type}`} />
                <span className="dl-activity-item__time">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="dl-section__header">
            <h2 className="dl-section__title">Quick Actions</h2>
          </div>
          <div className="dl-quick-actions">
            {quickActions.map((action, i) => (
              <button key={i} className="dl-quick-action" onClick={() => handleQuickAction(action.text)}>
                <span className="dl-quick-action__icon">{action.icon}</span>
                <span className="dl-quick-action__label">{action.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compact Chat Widget */}
      <section className="dl-chat-section">
        <ChatPanel fresh onFreshSubmit={handleFreshSubmit} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add welcome banner styles to DashboardLanding.css**

```css
.dl-welcome-banner {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
  box-shadow: 0 4px 16px rgba(0, 86, 145, 0.06);
}

.dl-welcome-title {
  font-size: var(--bosch-size-2xl);
  font-weight: 700;
  margin: 0 0 4px;
}

.dl-welcome-sub {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
}
```

- [ ] **Step 3: Update dashboard layout for gap and scroll**

Update the `.dashboard-landing` rule to add `gap` and `overflow-y: auto`:

```css
.dashboard-landing {
  padding: 20px 28px 12px;
  overflow-y: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: transparent;
}
```

- [ ] **Step 4: Update onNavigate in App.jsx**

In `App.jsx`, update `handleDashboardNav` to use `pendingMessage` instead of `setTimeout`:

```js
const { setPendingMessage } = useAgentContext();

const handleDashboardNav = (view, message) => {
  setActiveView(view);
  if (message) {
    setPendingMessage(message);
  }
};
```

Pass `onNavigate={(view) => setActiveView(view)}` to `DashboardLanding` (the component handles message/conversation creation internally now).

- [ ] **Step 5: Verify**

Dashboard should show: welcome banner, 4 stat cards, activity feed + quick actions side by side, compact chat at bottom. Quick action chips should navigate to chat and send message.

- [ ] **Step 6: Commit**

```bash
git add src/components/DashboardLanding.jsx src/styles/DashboardLanding.css src/App.jsx
git commit -m "feat: full dashboard landing with stats, activity feed, quick actions, compact chat"
```

---

## Task 8: AgentPanel with Filter and Search

**Files:**
- Modify: `src/components/AgentPanel.jsx`
- Modify: `src/styles/AgentPanel.css`
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace inline agents grid in App.jsx**

In `App.jsx`, replace the inline `agents.map(...)` block (lines 49-85) with:

```jsx
{activeView === 'agents' && (
  <AgentPanel onSelectAgent={setSelectedAgent} />
)}
```

Add import: `import AgentPanel from './components/AgentPanel';` (not currently imported in App.jsx — must be added).

**Important: unified context destructuring in AppContent.** The current `App.jsx` only destructures `{ agents, sendMessage }` from context (line 17). Multiple tasks (7, 8, 9, 13) need additional context values. Update the destructuring once here to avoid piecemeal changes:

```js
const { agents, setAgents, sendMessage, conversations, setConversations,
  activeConversation, setActiveConversation, createConversation,
  workflows, notifications, pendingMessage, setPendingMessage } = useAgentContext();
```

- [ ] **Step 2: Rewrite AgentPanel with filter and search**

```jsx
import React, { useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useAgentContext } from '../context/AgentContext';
import '../styles/AgentPanel.css';

export default function AgentPanel({ onSelectAgent }) {
  const { agents } = useAgentContext();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = agents.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.capabilities.some(c => c.toLowerCase().includes(q));
    }
    return true;
  });

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'idle', label: 'Idle' },
    { id: 'error', label: 'Error' },
  ];

  return (
    <div className="agent-panel-view">
      <div className="agent-panel-toolbar">
        <div className="agent-filter-bar">
          {filters.map(f => (
            <button
              key={f.id}
              className={`filter-pill ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.id !== 'all' && (
                <span className="filter-count">
                  {agents.filter(a => a.status === f.id).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="agent-search-box">
          <FiSearch size={14} />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="agents-grid-view">
        {filtered.map((agent) => (
          <div
            key={agent.id}
            className={`agent-card-large status-${agent.status}`}
            onClick={() => onSelectAgent(agent)}
          >
            <div className="agent-card-large-header">
              <span className="agent-icon-large">{agent.icon}</span>
              <span className={`status-badge ${agent.status}`}>{agent.status}</span>
            </div>
            <h3>{agent.name}</h3>
            <p className="agent-desc">{agent.description}</p>
            <div className="agent-card-stats">
              <div className="stat">
                <span className="stat-value">{agent.tasksCompleted}</span>
                <span className="stat-label">Tasks Done</span>
              </div>
              <div className="stat">
                <span className="stat-value">{agent.avgResponseTime}</span>
                <span className="stat-label">Avg Time</span>
              </div>
              <div className="stat">
                <span className="stat-value">{agent.successRate}</span>
                <span className="stat-label">Success</span>
              </div>
            </div>
            <div className="agent-capabilities">
              {agent.capabilities.map((cap, i) => (
                <span key={i} className="capability-tag">{cap}</span>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="agent-empty-state">No agents match your search.</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add filter/search styles to AgentPanel.css**

```css
.agent-panel-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.agent-panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  gap: 16px;
  flex-shrink: 0;
}

.agent-filter-bar {
  display: flex;
  gap: 8px;
}

.filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 50px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-family);
}

.filter-pill:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.filter-pill.active {
  background: var(--accent-primary);
  color: white;
  border-color: var(--accent-primary);
}

.filter-count {
  font-size: var(--font-size-xs);
  opacity: 0.7;
}

.agent-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.agent-search-box input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  width: 160px;
}

.agent-empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: var(--font-size-base);
}
```

- [ ] **Step 4: Verify**

Agents view should show filter pills, search box, and the grid. Filtering and searching should work.

- [ ] **Step 5: Commit**

```bash
git add src/components/AgentPanel.jsx src/styles/AgentPanel.css src/App.jsx
git commit -m "feat: agent panel with filter bar, search, replacing inline grid"
```

---

## Task 9: Functional AgentDetailModal

**Files:**
- Modify: `src/components/AgentDetailModal.jsx`
- Modify: `src/styles/AgentDetailModal.css`

- [ ] **Step 1: Add context access and onNavigateToChat prop**

```jsx
import React, { useState } from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/AgentDetailModal.css';

export default function AgentDetailModal({ agent, onClose, onNavigateToChat }) {
  const { setAgents } = useAgentContext();
  const [showAllLogs, setShowAllLogs] = useState(false);
```

- [ ] **Step 2: Implement action handlers**

```js
const handleSendTask = () => {
  onClose();
  onNavigateToChat(agent.name);
};

const handleToggleStatus = () => {
  setAgents(prev => prev.map(a =>
    a.id === agent.id
      ? { ...a, status: a.status === 'active' ? 'idle' : 'active' }
      : a
  ));
};

const generateMockLogs = () => {
  const types = ['info', 'success', 'warning', 'error'];
  const messages = [
    'Processing incoming request',
    'Task completed successfully',
    'Response time exceeded threshold',
    'Connection retry attempt',
    'Data validation passed',
    'Cache refreshed',
    'Scheduled maintenance check',
    'User session authenticated',
    'Report generated and sent',
    'Configuration updated',
    'Health check passed',
    'Queue processing complete',
    'Rate limit warning',
    'Backup completed',
    'API response cached',
  ];
  return messages.map((msg, i) => ({
    time: `${String(9 + Math.floor(i / 4)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
    message: msg,
    type: types[i % types.length],
  }));
};

const displayedLogs = showAllLogs ? generateMockLogs() : agent.logs;
```

- [ ] **Step 3: Update action buttons in JSX**

```jsx
<div className="modal-actions">
  <button className="btn-primary" onClick={handleSendTask}>Send Task</button>
  <button className="btn-outline" onClick={() => setShowAllLogs(!showAllLogs)}>
    {showAllLogs ? 'Show Recent' : 'View Full Logs'}
  </button>
  {agent.status === 'active' ? (
    <button className="btn-danger" onClick={handleToggleStatus}>Pause Agent</button>
  ) : (
    <button className="btn-success" onClick={handleToggleStatus}>Activate Agent</button>
  )}
</div>
```

- [ ] **Step 4: Pass onNavigateToChat from App.jsx**

In `App.jsx`, update the modal rendering:

```jsx
{selectedAgent && (
  <AgentDetailModal
    agent={selectedAgent}
    onClose={() => setSelectedAgent(null)}
    onNavigateToChat={(agentName) => {
      setSelectedAgent(null);
      setActiveView('chat');
      const convId = createConversation('Task for ' + agentName);
      setPendingMessage('I need help from ' + agentName);
    }}
  />
)}
```

Pull `createConversation` and `setPendingMessage` from context in `AppContent`.

- [ ] **Step 5: Verify**

Open an agent modal. "Send Task" should navigate to chat with the agent. "Pause Agent" should toggle the status badge. "View Full Logs" should show more entries.

- [ ] **Step 6: Commit**

```bash
git add src/components/AgentDetailModal.jsx src/App.jsx
git commit -m "feat: functional agent modal actions - send task, pause/activate, view logs"
```

---

## Task 10: WorkflowsPanel Extraction and Enhancement

**Files:**
- Create: `src/components/WorkflowsPanel.jsx`
- Create: `src/components/WorkflowCreateModal.jsx`
- Create: `src/styles/WorkflowsPanel.css` (extract from App.css)
- Create: `src/styles/WorkflowCreateModal.css`
- Modify: `src/App.jsx`
- Modify: `src/styles/App.css`

- [ ] **Step 1: Extract WorkflowsPanel from App.jsx**

Create `src/components/WorkflowsPanel.jsx`. Move the `WorkflowsPanel` function from `App.jsx` into this new file. Import from context instead of using hardcoded data:

```jsx
import React, { useState } from 'react';
import { useAgentContext } from '../context/AgentContext';
import WorkflowCreateModal from './WorkflowCreateModal';
import '../styles/WorkflowsPanel.css';

export default function WorkflowsPanel() {
  const { workflows, setWorkflows, agents } = useAgentContext();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [runningWorkflows, setRunningWorkflows] = useState({});

  const handleRun = (wfId) => {
    setRunningWorkflows(prev => ({ ...prev, [wfId]: { step: 0, status: 'running' } }));
    const wf = workflows.find(w => w.id === wfId);
    const totalSteps = wf.steps;

    // Simulate step-by-step execution
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= totalSteps) {
        clearInterval(interval);
        setRunningWorkflows(prev => ({ ...prev, [wfId]: { step: totalSteps, status: 'completed' } }));
        setWorkflows(prev => prev.map(w => w.id === wfId ? { ...w, status: 'active', lastRun: 'Just now' } : w));
      } else {
        setRunningWorkflows(prev => ({ ...prev, [wfId]: { step, status: 'running' } }));
      }
    }, 1500);
  };

  const handleDelete = (wfId) => {
    if (window.confirm('Delete this workflow?')) {
      setWorkflows(prev => prev.filter(w => w.id !== wfId));
    }
  };

  const handleSave = (workflow) => {
    if (editingWorkflow) {
      setWorkflows(prev => prev.map(w => w.id === editingWorkflow.id ? { ...workflow, id: editingWorkflow.id } : w));
    } else {
      setWorkflows(prev => [...prev, { ...workflow, id: Date.now(), status: 'idle', lastRun: 'Never' }]);
    }
    setShowCreateModal(false);
    setEditingWorkflow(null);
  };

  return (
    <div className="workflows-container">
      <div className="workflows-header">
        <h2>Workflow Orchestrations</h2>
        <button className="btn-primary" onClick={() => { setEditingWorkflow(null); setShowCreateModal(true); }}>
          + New Workflow
        </button>
      </div>
      <div className="workflows-list">
        {workflows.map((wf) => {
          const runState = runningWorkflows[wf.id];
          return (
            <div key={wf.id} className={`workflow-card status-${wf.status}`}>
              <div className="workflow-card-top">
                <h3>{wf.name}</h3>
                <span className={`status-badge ${runState?.status === 'running' ? 'active' : wf.status}`}>
                  {runState?.status === 'running' ? `Step ${runState.step + 1}/${wf.steps}` : wf.status}
                </span>
              </div>
              <div className="workflow-meta">
                <span>{wf.steps} steps</span>
                <span>{wf.lastRun}</span>
              </div>
              <div className="workflow-agents">
                {wf.agents.map((a, i) => (
                  <span key={i} className="workflow-agent-chip">{a}</span>
                ))}
              </div>
              <div className="workflow-actions">
                <button className="btn-sm btn-outline" onClick={() => { setEditingWorkflow(wf); setShowCreateModal(true); }}>
                  Edit
                </button>
                <button className="btn-sm btn-danger" onClick={() => handleDelete(wf.id)}>
                  Delete
                </button>
                <button
                  className="btn-sm btn-primary"
                  onClick={() => handleRun(wf.id)}
                  disabled={runState?.status === 'running'}
                >
                  {runState?.status === 'running' ? 'Running...' : 'Run'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {showCreateModal && (
        <WorkflowCreateModal
          agents={agents}
          workflow={editingWorkflow}
          onSave={handleSave}
          onClose={() => { setShowCreateModal(false); setEditingWorkflow(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create WorkflowCreateModal**

```jsx
import React, { useState } from 'react';
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import '../styles/WorkflowCreateModal.css';

export default function WorkflowCreateModal({ agents, workflow, onSave, onClose }) {
  const [name, setName] = useState(workflow?.name || '');
  const [steps, setSteps] = useState(
    workflow?.agents.map((a, i) => ({ id: i, agent: a, description: '' })) || [{ id: 0, agent: '', description: '' }]
  );

  const addStep = () => {
    setSteps(prev => [...prev, { id: Date.now(), agent: '', description: '' }]);
  };

  const removeStep = (id) => {
    if (steps.length > 1) setSteps(prev => prev.filter(s => s.id !== id));
  };

  const updateStep = (id, field, value) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      steps: steps.length,
      agents: steps.map(s => s.agent).filter(Boolean),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wf-modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><FiX size={18} /></button>
        <h2>{workflow ? 'Edit Workflow' : 'Create Workflow'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="wf-form-group">
            <label>Workflow Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Customer Support Pipeline" />
          </div>
          <div className="wf-form-group">
            <label>Steps</label>
            {steps.map((step, idx) => (
              <div key={step.id} className="wf-step-row">
                <span className="wf-step-num">{idx + 1}</span>
                <select value={step.agent} onChange={e => updateStep(step.id, 'agent', e.target.value)}>
                  <option value="">Select Agent</option>
                  {agents.map(a => <option key={a.id} value={a.name}>{a.icon} {a.name}</option>)}
                </select>
                <button type="button" className="wf-step-remove" onClick={() => removeStep(step.id)}>
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="btn-outline wf-add-step" onClick={addStep}>
              <FiPlus size={14} /> Add Step
            </button>
          </div>
          <div className="wf-modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{workflow ? 'Save Changes' : 'Create Workflow'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create WorkflowCreateModal.css**

```css
.wf-modal-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-xl);
  padding: 32px;
  max-width: 520px;
  width: 90vw;
  position: relative;
  max-height: 80vh;
  overflow-y: auto;
}

.wf-modal-content h2 {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin-bottom: 24px;
}

.wf-form-group {
  margin-bottom: 20px;
}

.wf-form-group label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.wf-form-group input,
.wf-form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.wf-form-group input:focus,
.wf-form-group select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 86, 145, 0.1);
}

.wf-step-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.wf-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 700;
  flex-shrink: 0;
}

.wf-step-row select {
  flex: 1;
}

.wf-step-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.wf-step-remove:hover {
  color: var(--danger);
  background: var(--danger-bg);
}

.wf-add-step {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.wf-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}
```

- [ ] **Step 4: Extract workflow styles from App.css to WorkflowsPanel.css**

Create `src/styles/WorkflowsPanel.css` containing the workflow-related styles from `App.css` (`.workflows-view` through `.workflow-actions`). Then import it in `WorkflowsPanel.jsx`.

Remove those styles from `App.css`.

- [ ] **Step 5: Update App.jsx — remove inline WorkflowsPanel, import extracted one**

Delete the inline `function WorkflowsPanel()` from `App.jsx`. Add:
```js
import WorkflowsPanel from './components/WorkflowsPanel';
```

The `{activeView === 'workflows' && ...}` block in `App.jsx` already wraps `<WorkflowsPanel />`, so just remove the wrapper div if present and keep the component call.

- [ ] **Step 6: Verify**

Workflows view shows cards with real agent names. "New Workflow" opens modal with agent picker. "Run" shows step progress. "Edit" reopens modal pre-filled. "Delete" removes with confirmation.

- [ ] **Step 7: Commit**

```bash
git add src/components/WorkflowsPanel.jsx src/components/WorkflowCreateModal.jsx src/styles/WorkflowsPanel.css src/styles/WorkflowCreateModal.css src/App.jsx src/styles/App.css
git commit -m "feat: extract WorkflowsPanel with CRUD, run simulation, create modal"
```

---

## Task 11: SearchDropdown Component

**Files:**
- Create: `src/components/SearchDropdown.jsx`
- Create: `src/styles/SearchDropdown.css`

- [ ] **Step 1: Create SearchDropdown**

```jsx
import React from 'react';
import { FiCpu, FiMessageSquare, FiGitMerge } from 'react-icons/fi';
import '../styles/SearchDropdown.css';

export default function SearchDropdown({ query, agents, conversations, workflows, onSelect, onClose }) {
  if (!query.trim()) return null;
  const q = query.toLowerCase();

  const matchedAgents = agents.filter(a =>
    a.name.toLowerCase().includes(q) || a.capabilities.some(c => c.toLowerCase().includes(q))
  ).slice(0, 3);

  const matchedConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(q)
  ).slice(0, 3);

  const matchedWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(q)
  ).slice(0, 3);

  const hasResults = matchedAgents.length || matchedConversations.length || matchedWorkflows.length;

  return (
    <div className="search-dropdown">
      {!hasResults && <div className="search-empty">No results for "{query}"</div>}

      {matchedAgents.length > 0 && (
        <div className="search-section">
          <div className="search-section-title"><FiCpu size={12} /> Agents</div>
          {matchedAgents.map(a => (
            <button key={a.id} className="search-result-item" onClick={() => onSelect('agents', a)}>
              <span className="search-result-icon">{a.icon}</span>
              <span className="search-result-text">{a.name}</span>
              <span className={`status-badge ${a.status}`}>{a.status}</span>
            </button>
          ))}
        </div>
      )}

      {matchedConversations.length > 0 && (
        <div className="search-section">
          <div className="search-section-title"><FiMessageSquare size={12} /> Conversations</div>
          {matchedConversations.map(c => (
            <button key={c.id} className="search-result-item" onClick={() => onSelect('chat', c)}>
              <span className="search-result-text">{c.title}</span>
              <span className="search-result-meta">{c.timestamp}</span>
            </button>
          ))}
        </div>
      )}

      {matchedWorkflows.length > 0 && (
        <div className="search-section">
          <div className="search-section-title"><FiGitMerge size={12} /> Workflows</div>
          {matchedWorkflows.map(w => (
            <button key={w.id} className="search-result-item" onClick={() => onSelect('workflows', w)}>
              <span className="search-result-text">{w.name}</span>
              <span className={`status-badge ${w.status}`}>{w.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create SearchDropdown.css**

```css
.search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  max-height: 400px;
  overflow-y: auto;
  animation: searchSlide 0.15s ease-out;
}

@keyframes searchSlide {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.search-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.search-section {
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}

.search-section:last-child {
  border-bottom: none;
}

.search-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 14px 6px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-family);
  font-size: var(--font-size-sm);
  text-align: left;
  transition: background var(--transition-fast);
}

.search-result-item:hover {
  background: var(--bg-hover);
}

.search-result-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.search-result-text {
  flex: 1;
  color: var(--text-primary);
}

.search-result-meta {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchDropdown.jsx src/styles/SearchDropdown.css
git commit -m "feat: add SearchDropdown component for header search"
```

---

## Task 12: NotificationsDropdown Component

**Files:**
- Create: `src/components/NotificationsDropdown.jsx`
- Create: `src/styles/NotificationsDropdown.css`

- [ ] **Step 1: Create NotificationsDropdown**

```jsx
import React from 'react';
import { useAgentContext } from '../context/AgentContext';
import '../styles/NotificationsDropdown.css';

export default function NotificationsDropdown({ onClose }) {
  const { notifications, setNotifications } = useAgentContext();
  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="notif-dropdown">
      <div className="notif-header">
        <span className="notif-title">Notifications</span>
        {unreadCount > 0 && (
          <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>
        )}
      </div>
      <div className="notif-list">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notif-item ${n.read ? 'read' : 'unread'}`}
            onClick={() => markRead(n.id)}
          >
            <div className={`notif-dot ${n.read ? '' : 'unread'}`} />
            <div className="notif-content">
              <span className="notif-text">{n.text}</span>
              <span className="notif-time">{n.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create NotificationsDropdown.css**

```css
.notif-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  width: 360px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  overflow: hidden;
  animation: notifSlide 0.15s ease-out;
}

@keyframes notifSlide {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.notif-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
}

.notif-title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-primary);
}

.notif-mark-all {
  background: none;
  border: none;
  color: var(--accent-primary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font-family);
}

.notif-mark-all:hover {
  text-decoration: underline;
}

.notif-list {
  max-height: 360px;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.notif-item:last-child {
  border-bottom: none;
}

.notif-item:hover {
  background: var(--bg-hover);
}

.notif-item.unread {
  background: var(--info-bg);
}

.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
  margin-top: 5px;
}

.notif-dot.unread {
  background: var(--accent-primary);
}

.notif-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.notif-text {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  line-height: 1.4;
}

.notif-time {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationsDropdown.jsx src/styles/NotificationsDropdown.css
git commit -m "feat: add NotificationsDropdown component"
```

---

## Task 13: Enhance DashboardHeader with Search and Notifications

**Files:**
- Modify: `src/components/DashboardHeader.jsx`
- Modify: `src/styles/DashboardHeader.css`

- [ ] **Step 1: Wire up SearchDropdown and NotificationsDropdown**

Rewrite `DashboardHeader.jsx`:

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { FiSearch, FiBell } from 'react-icons/fi';
import { useAgentContext } from '../context/AgentContext';
import SearchDropdown from './SearchDropdown';
import NotificationsDropdown from './NotificationsDropdown';
import '../styles/DashboardHeader.css';

export default function DashboardHeader({ activeView, onViewChange, onSelectAgent }) {
  const { agents, conversations, workflows, notifications, setActiveConversation } = useAgentContext();
  const activeCount = agents.filter(a => a.status === 'active').length;
  const unreadCount = notifications.filter(n => !n.read).length;

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  const titles = {
    dashboard: 'Dashboard',
    chat: 'Orchestrator Chat',
    agents: 'Agent Management',
    workflows: 'Workflow Orchestrations',
  };

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') { setShowSearch(false); setShowNotif(false); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleSearchSelect = (view, item) => {
    setShowSearch(false);
    setSearchQuery('');
    if (view === 'agents' && onSelectAgent) {
      onSelectAgent(item);
    } else if (view === 'chat') {
      setActiveConversation(item.id);
      onViewChange('chat');
    } else {
      onViewChange(view);
    }
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1 className="header-title">{titles[activeView] || 'Dashboard'}</h1>
        <div className="header-status">
          <span className="status-dot active" />
          <span>{activeCount} agents active</span>
        </div>
      </div>
      <div className="header-right">
        <div className="search-box" ref={searchRef}>
          <FiSearch size={14} className="search-icon-svg" />
          <input
            type="text"
            placeholder="Search agents, conversations..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => searchQuery && setShowSearch(true)}
          />
          {showSearch && (
            <SearchDropdown
              query={searchQuery}
              agents={agents}
              conversations={conversations}
              workflows={workflows}
              onSelect={handleSearchSelect}
              onClose={() => setShowSearch(false)}
            />
          )}
        </div>
        <div className="notif-wrapper" ref={notifRef}>
          <button
            className="btn-icon notification-btn"
            title="Notifications"
            onClick={() => setShowNotif(!showNotif)}
          >
            <FiBell size={18} />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </button>
          {showNotif && <NotificationsDropdown onClose={() => setShowNotif(false)} />}
        </div>
        <div className="user-avatar" title="User Profile">
          <span>U</span>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Add styles for search positioning and notification wrapper**

Add to `DashboardHeader.css`:

```css
.search-box {
  position: relative;
}

.search-icon-svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

.notif-wrapper {
  position: relative;
}
```

Remove the old emoji `🔍` and `🔔` references if hardcoded in CSS.

- [ ] **Step 3: Update App.jsx to pass new props to DashboardHeader**

```jsx
<DashboardHeader
  activeView={activeView}
  onViewChange={setActiveView}
  onSelectAgent={setSelectedAgent}
/>
```

- [ ] **Step 4: Verify**

Type in search box — dropdown shows matching agents/conversations/workflows. Click result to navigate. Bell icon shows dropdown with notifications. Mark as read works.

- [ ] **Step 5: Commit**

```bash
git add src/components/DashboardHeader.jsx src/styles/DashboardHeader.css src/App.jsx
git commit -m "feat: functional search dropdown and notifications in header"
```

---

## Task 14: InteractiveBackground Reduced Motion Support

**Files:**
- Modify: `src/components/InteractiveBackground.jsx`
- Modify: `src/styles/InteractiveBackground.css`

- [ ] **Step 1: Add reduced motion check**

In `InteractiveBackground.jsx`, at the start of the `useEffect`, add:

```js
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) {
  // Draw static particles once, no animation loop
  resize();
  particles.current = initParticles(w, h);
  // Draw once
  for (const p of particles.current) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 86, 145, ${p.opacity})`;
    ctx.fill();
  }
  return () => {
    window.removeEventListener('resize', resize);
  };
}
```

- [ ] **Step 2: Add global reduced motion rule to index.css**

Add at the end of `src/styles/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/InteractiveBackground.jsx src/styles/index.css
git commit -m "feat: reduced motion support for background and global animations"
```

---

## Task 15: Responsive Breakpoints and Final Polish

**Files:**
- Modify: `src/styles/App.css`
- Modify: `src/styles/Sidebar.css`
- Modify: `src/styles/AgentPanel.css`

- [ ] **Step 1: Add responsive breakpoints to App.css**

```css
/* Tablet */
@media (max-width: 1024px) {
  .sidebar {
    width: var(--sidebar-collapsed-width);
  }
  .sidebar .nav-label,
  .sidebar .logo-text,
  .sidebar .conversation-list,
  .sidebar .sidebar-footer .nav-label {
    display: none;
  }
  .main-content {
    margin-left: var(--sidebar-collapsed-width);
  }
}

/* Mobile */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -280px;
    top: 0;
    bottom: 0;
    z-index: 50;
    transition: left var(--transition-normal);
    width: var(--sidebar-width);
  }
  .sidebar:not(.collapsed) {
    left: 0;
  }
  .main-content {
    margin-left: 0;
  }
  .agents-grid-view {
    grid-template-columns: 1fr;
  }
  .workflows-list {
    grid-template-columns: 1fr;
  }
  .modal-content, .wf-modal-content {
    max-width: 100vw;
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
}
```

- [ ] **Step 2: Add cursor pointer to all interactive elements**

Add to `src/styles/index.css`:

```css
.nav-item,
.conversation-item,
.agent-card-large,
.workflow-card,
.dl-activity-item,
.dl-quick-action,
.dl-conversation-card,
.search-result-item,
.notif-item {
  cursor: pointer;
}
```

- [ ] **Step 3: Verify all breakpoints**

Resize browser to:
- 1440px (desktop) — full sidebar + content
- 900px (tablet) — sidebar collapsed
- 375px (mobile) — sidebar hidden, single column

- [ ] **Step 4: Run production build**

```bash
cd /Users/home/LAUNCHER-2.0 && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/styles/App.css src/styles/index.css src/styles/Sidebar.css src/styles/AgentPanel.css
git commit -m "feat: responsive breakpoints, cursor pointer polish, production build verified"
```

---

## Task 16: Skeleton States and Keyboard Navigation

**Files:**
- Modify: `src/styles/App.css`
- Modify: `src/components/DashboardHeader.jsx`

- [ ] **Step 1: Add skeleton CSS utility classes to App.css**

```css
/* Skeleton loading placeholders */
.skeleton {
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-hover) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-md);
}

@keyframes skeletonPulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-card {
  height: 120px;
  width: 100%;
}

.skeleton-line {
  height: 16px;
  width: 80%;
  margin-bottom: 8px;
}

.skeleton-line--short {
  width: 40%;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--bg-tertiary);
  }
}
```

These classes can be applied by any component during loading states. Components should show skeletons while data is being prepared (e.g., when `agents.length === 0`).

- [ ] **Step 2: Add arrow key navigation to search dropdown**

In `DashboardHeader.jsx`, add arrow key support to the search input:

```js
const [activeIndex, setActiveIndex] = useState(-1);

const handleSearchKeyDown = (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActiveIndex(prev => prev + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActiveIndex(prev => Math.max(-1, prev - 1));
  } else if (e.key === 'Enter' && activeIndex >= 0) {
    e.preventDefault();
    // Select the currently highlighted result
  }
};
```

Pass `activeIndex` to `SearchDropdown` as a prop. In `SearchDropdown`, add `aria-selected` and visual highlight to the active item.

- [ ] **Step 3: Verify**

Tab through the page — focus should be visible on all interactive elements. Arrow keys in search dropdown should navigate results.

- [ ] **Step 4: Commit**

```bash
git add src/styles/App.css src/components/DashboardHeader.jsx src/components/SearchDropdown.jsx
git commit -m "feat: skeleton loading states and keyboard navigation for search"
```

---

## Task 17: Final Integration Verification

- [ ] **Step 1: Start dev server and verify all views**

```bash
npm run dev
```

Verify each flow:
1. **Dashboard:** Welcome banner, 4 stats, activity feed, quick actions, compact chat widget
2. **Chat:** Send message -> typing indicator -> orchestrator with delegations -> agent response. Try "reimbursement" (routes to Internet Reimbursement), "lunch" (routes to Canteen), "VPN issue" (routes to IT Support). Test multi-turn: answer follow-up questions.
3. **Agents:** Filter by status, search by name/capability, click agent -> modal -> Send Task navigates to chat, Pause/Activate toggles status, View Full Logs shows more entries
4. **Workflows:** View cards with real agent names, create new workflow, edit existing, run simulation (step progress), delete
5. **Search:** Type in header search -> dropdown with agents/conversations/workflows -> click to navigate
6. **Notifications:** Bell icon -> dropdown -> click to mark read -> mark all read
7. **Sidebar:** SVG icons, new chat, conversation delete, switch conversations loads different messages
8. **Responsive:** Resize to tablet and mobile breakpoints

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: RBIN BDO Genie full frontend implementation complete"
```
