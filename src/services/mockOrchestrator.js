// Mock Orchestrator Service Layer
// Handles keyword routing, conversation trees, and response pipeline

// --- Keyword Router ---
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

// --- Dynamic ID helper ---
const randomId = (prefix) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

// --- Conversation Trees ---
// Every response is a function () => string for dynamic ID generation
export const CONVERSATION_TREES = {
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
  'ezycabs': {
    entry: {
      response: () => "I'll help you book a cab. **What's the pickup location and time?**",
      nextState: 'details_provided',
    },
    details_provided: {
      response: () => `**Cab booked!**\n\n- **Driver:** Rajesh K.\n- **Vehicle:** MH-12-AB-${Math.floor(1000 + Math.random() * 9000)}\n- **ETA:** 8 minutes\n\nYou'll receive an SMS confirmation shortly.`,
      nextState: null,
    },
  },
  'canteen-services': {
    entry: {
      response: () => {
        const menus = [
          "**Today's Lunch Menu:**\n\n- 🍛 Dal Makhani + Jeera Rice\n- 🍗 Grilled Chicken with Veggies\n- 🥗 Caesar Salad Bar\n- 🍜 Veg Noodle Soup\n\nWould you like to **pre-order** your meal?",
          "**Today's Lunch Menu:**\n\n- 🍛 Paneer Butter Masala + Roti\n- 🍗 Fish Curry with Steamed Rice\n- 🥗 Greek Salad Bar\n- 🍜 Tom Yum Soup\n\nWould you like to **pre-order** your meal?",
          "**Today's Lunch Menu:**\n\n- 🍛 Chole Bhature\n- 🍗 Butter Chicken + Naan\n- 🥗 Quinoa Bowl\n- 🍜 Minestrone Soup\n\nWould you like to **pre-order** your meal?",
        ];
        return menus[Math.floor(Math.random() * menus.length)];
      },
      nextState: 'preorder',
    },
    preorder: {
      response: () => `**Pre-order confirmed!**\n\n- **Pickup:** Counter 3, 12:30 PM\n- **Order ID:** ${randomId('CO')}\n\nYou'll receive a reminder 15 minutes before pickup.`,
      nextState: null,
    },
  },
  'facility-it-support': {
    entry: {
      response: () => "I'll create a ticket for this. Can you **describe the issue** in more detail?",
      nextState: 'issue_described',
    },
    issue_described: {
      response: () => `**Ticket created!**\n\n- **Ticket ID:** ${randomId('IT-2025')}\n- **Priority:** Medium\n- **Assigned to:** IT Helpdesk Team\n- **Expected resolution:** Within 4 hours (SLA)\n\nYou can track your ticket status in the IT portal.`,
      nextState: null,
    },
  },
  'employee-onboarding': {
    entry: {
      response: () => "Welcome! I'll guide you through onboarding. **What's your employee ID?**",
      nextState: 'id_provided',
    },
    id_provided: {
      response: () => `**Here's your onboarding checklist:**\n\n1. ✅ ID Card & Access Badge\n2. ⬜ IT Asset Setup (Laptop, Email)\n3. ⬜ HR Documentation\n4. ⬜ Safety & Compliance Training\n5. ⬜ Team Introduction\n\n- **Your Buddy:** Priya M. (ext. 4521)\n- **First Training:** Tomorrow, 10:00 AM, Room B-204\n\nI'll send you reminders for each step.`,
      nextState: null,
    },
  },
  'visitor-management': {
    entry: {
      response: () => "I'll set up a visitor pass. **Visitor name and expected date?**",
      nextState: 'details_provided',
    },
    details_provided: {
      response: () => `**Gate pass generated!**\n\n- **Pass ID:** ${randomId('VP')}\n- **Status:** Active\n- **Host notified:** Yes\n\nThe visitor will receive entry instructions via email. Please ensure they carry a valid photo ID.`,
      nextState: null,
    },
  },
  'retiral-benefits': {
    entry: {
      response: () => "What would you like to know — **PF balance**, **gratuity estimate**, or **pension planning**?",
      nextState: 'topic_selected',
    },
    topic_selected: {
      response: () => `**Your Retiral Benefits Summary:**\n\n- **PF Balance:** Rs.4,85,230 (as of March 2025)\n- **Employer Contribution (YTD):** Rs.72,000\n- **Gratuity Estimate:** Rs.3,12,500 (based on ${Math.floor(3 + Math.random() * 8)} years of service)\n\nFor detailed statements, visit the EPFO portal or contact HR.`,
      nextState: null,
    },
  },
  'ezyclaim': {
    entry: {
      response: () => "I'll help with your expense claim. What type — **travel**, **meals**, or **miscellaneous**?",
      nextState: 'type_selected',
    },
    type_selected: {
      response: () => "Please provide: **date**, **amount**, and **upload the receipt**.",
      nextState: 'receipt_provided',
    },
    receipt_provided: {
      response: () => `**Claim filed!**\n\n- **Claim ID:** ${randomId('EX-2025')}\n- **Amount:** Rs.${(Math.floor(5 + Math.random() * 20) * 100).toLocaleString()}\n- **Routed to:** Manager for approval\n\nExpected approval time: 1-2 business days.`,
      nextState: null,
    },
  },
  'governance-security': {
    entry: {
      response: () => "What do you need — **compliance check**, **access request**, or **security incident report**?",
      nextState: 'topic_selected',
    },
    topic_selected: {
      response: () => `**Action taken:**\n\n- **Request ID:** ${randomId('GS-2025')}\n- **Type:** Compliance Review\n- **Status:** Under review by Security Team\n- **SLA:** 24 hours\n\nYou'll receive a notification once the review is complete.`,
      nextState: null,
    },
  },
  'triage-process': {
    entry: {
      response: (content) => {
        // Secondary keyword scan
        const secondaryMatch = routeMessage(content);
        if (secondaryMatch !== 'triage-process') {
          return "I've analyzed your request and classified it. Routing to the appropriate agent for resolution.";
        }
        return "I wasn't able to route your request. Could you rephrase or try one of these options?";
      },
      nextState: null,
      handOff: true,
    },
  },
};

// --- Response Pipeline ---
export function processMessage(content, convState, agents) {
  let targetAgentId = convState.activeAgent || routeMessage(content);
  const isTriage = targetAgentId === 'triage-process' && !convState.activeAgent;

  // Triage hand-off: if triage matched, do secondary scan and hand off
  let handOffAgentId = null;
  if (isTriage) {
    handOffAgentId = 'facility-it-support'; // default fallback
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

  // Call response function
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

// --- Message Queue ---
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

// --- ID Generation ---
let _msgId = 100;
export function generateMsgId() {
  return `msg-${Date.now()}-${_msgId++}`;
}
