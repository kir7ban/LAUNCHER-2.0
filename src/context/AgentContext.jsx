import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getClient, EventType } from '../services/orchestratorClient';

const AgentContext = createContext();

// ── ID generator ──────────────────────────────────────────────────────────────
let _msgSeq = 0;
function generateMsgId() {
  return `msg-${Date.now()}-${_msgSeq++}`;
}

// ── Static seed data ──────────────────────────────────────────────────────────
const initialAgents = [
  {
    id: 'internet-reimbursement',
    name: 'Internet Reimbursement',
    icon: '🌐',
    status: 'active',
    description: 'Handles internet expense reimbursement claims, validates receipts, and processes monthly allowance payouts.',
    capabilities: ['Claim Submission', 'Receipt Validation', 'Reimbursement Tracking', 'Policy Compliance'],
    tasksCompleted: 1540,
    avgResponseTime: '0.8s',
    successRate: '99.1%',
    model: 'GPT-4o',
    lastActive: 'Just now',
    logs: [
      { time: '10:32:01', message: 'Processing reimbursement claim for March', type: 'info' },
      { time: '10:32:03', message: 'Receipt validated successfully', type: 'success' },
      { time: '10:32:04', message: 'Claim approved and forwarded to payroll', type: 'success' },
    ],
  },
  {
    id: 'governance-security',
    name: 'Governance & Security',
    icon: '🛡️',
    status: 'active',
    description: 'Manages governance policies, security compliance checks, access control, and regulatory adherence.',
    capabilities: ['Policy Enforcement', 'Access Management', 'Compliance Audits', 'Security Alerts'],
    tasksCompleted: 987,
    avgResponseTime: '1.0s',
    successRate: '99.5%',
    model: 'GPT-4o',
    lastActive: '1 min ago',
    logs: [
      { time: '10:30:00', message: 'Completed compliance audit for Q1', type: 'success' },
      { time: '10:31:00', message: 'Updated security policy documentation', type: 'info' },
    ],
  },
  {
    id: 'ezyclaim',
    name: 'EzyClaim',
    icon: '📋',
    status: 'active',
    description: 'Streamlines employee expense claims including travel, meals, and miscellaneous reimbursements.',
    capabilities: ['Expense Filing', 'Auto-Categorization', 'Approval Routing', 'Status Tracking'],
    tasksCompleted: 2310,
    avgResponseTime: '0.6s',
    successRate: '98.7%',
    model: 'GPT-4o',
    lastActive: 'Just now',
    logs: [
      { time: '10:31:45', message: 'New travel claim submitted by employee', type: 'info' },
      { time: '10:31:50', message: 'Claim auto-categorized and sent to manager', type: 'success' },
    ],
  },
  {
    id: 'ezycabs',
    name: 'EzyCabs',
    icon: '🚕',
    status: 'active',
    description: 'Manages cab booking, ride scheduling, route optimization, and corporate transport services.',
    capabilities: ['Cab Booking', 'Ride Scheduling', 'Route Optimization', 'Fare Estimation'],
    tasksCompleted: 1876,
    avgResponseTime: '0.5s',
    successRate: '97.9%',
    model: 'GPT-4o',
    lastActive: '30s ago',
    logs: [
      { time: '10:32:00', message: 'Ride booked for employee pickup at Gate 3', type: 'success' },
      { time: '10:32:02', message: 'Driver assigned, ETA 5 minutes', type: 'info' },
    ],
  },
  {
    id: 'canteen-services',
    name: 'Canteen Services',
    icon: '🍽️',
    status: 'active',
    description: 'Manages cafeteria menus, meal pre-orders, dietary preferences, and nutritional information.',
    capabilities: ['Menu Display', 'Meal Pre-ordering', 'Dietary Tracking', 'Nutritional Info'],
    tasksCompleted: 3421,
    avgResponseTime: '0.4s',
    successRate: '99.8%',
    model: 'GPT-4o',
    lastActive: '2 min ago',
    logs: [
      { time: '10:30:00', message: 'Today\'s menu updated successfully', type: 'success' },
      { time: '10:31:30', message: '45 meal pre-orders confirmed for lunch', type: 'info' },
    ],
  },
  {
    id: 'facility-it-support',
    name: 'Facility & IT Support',
    icon: '🔧',
    status: 'active',
    description: 'Handles facility management requests, IT support tickets, and infrastructure maintenance.',
    capabilities: ['Ticket Management', 'IT Support', 'Facility Requests', 'SLA Tracking'],
    tasksCompleted: 1234,
    avgResponseTime: '1.2s',
    successRate: '96.5%',
    model: 'GPT-4o',
    lastActive: '5 min ago',
    logs: [
      { time: '10:25:00', message: 'IT ticket IT-2025-4521 resolved', type: 'success' },
      { time: '10:28:00', message: 'New facility request received', type: 'info' },
    ],
  },
  {
    id: 'employee-onboarding',
    name: 'Employee Guided Onboarding',
    icon: '👤',
    status: 'active',
    description: 'Guides new employees through the onboarding process, documentation, and initial setup.',
    capabilities: ['Onboarding Workflow', 'Document Collection', 'Training Assignment', 'Access Provisioning'],
    tasksCompleted: 456,
    avgResponseTime: '1.5s',
    successRate: '98.2%',
    model: 'GPT-4o',
    lastActive: '10 min ago',
    logs: [
      { time: '10:20:00', message: '3 new joiners onboarding initiated', type: 'info' },
      { time: '10:22:00', message: 'Access credentials provisioned', type: 'success' },
    ],
  },
  {
    id: 'visitor-management',
    name: 'Visitor Management',
    icon: '🏢',
    status: 'idle',
    description: 'Manages visitor registration, gate passes, and corporate access control.',
    capabilities: ['Visitor Registration', 'Gate Pass Generation', 'Host Notification', 'Access Tracking'],
    tasksCompleted: 789,
    avgResponseTime: '0.9s',
    successRate: '99.0%',
    model: 'GPT-4o',
    lastActive: '30 min ago',
    logs: [
      { time: '10:00:00', message: 'Visitor pass VP-4521 generated', type: 'success' },
    ],
  },
  {
    id: 'retiral-benefits',
    name: 'Retiral Benefits',
    icon: '🏦',
    status: 'idle',
    description: 'Provides information on PF, gratuity, pension, and other retiral benefits.',
    capabilities: ['PF Balance', 'Gratuity Calculation', 'Pension Planning', 'Benefits Overview'],
    tasksCompleted: 321,
    avgResponseTime: '1.1s',
    successRate: '99.3%',
    model: 'GPT-4o',
    lastActive: '1 hr ago',
    logs: [
      { time: '09:30:00', message: 'PF statement generated for Q1', type: 'success' },
    ],
  },
  {
    id: 'triage-process',
    name: 'Triage Process',
    icon: '🎯',
    status: 'active',
    description: 'Classifies and routes incoming requests to the appropriate specialized agents.',
    capabilities: ['Request Classification', 'Priority Assignment', 'Agent Routing', 'SLA Management'],
    tasksCompleted: 5678,
    avgResponseTime: '0.3s',
    successRate: '97.1%',
    model: 'GPT-4o',
    lastActive: 'Just now',
    logs: [
      { time: '10:32:00', message: 'Request routed to Internet Reimbursement', type: 'info' },
      { time: '10:31:55', message: 'Priority classified: Medium', type: 'info' },
    ],
  },
];

const initialConversations = [
  { id: 'conv-new', title: 'New Conversation', timestamp: 'Just now', preview: '' },
  {
    id: 'conv-1',
    title: 'Internet Reimbursement',
    timestamp: '10:32 AM',
    preview: 'Claim my internet reimbursement for March.',
  },
];

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

// ── Provider ──────────────────────────────────────────────────────────────────
export function AgentProvider({ children }) {
  const [agents, setAgents] = useState(initialAgents);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversation, setActiveConversation] = useState('conv-new');
  const [messagesMap, setMessagesMap] = useState({ 'conv-new': [], 'conv-1': [] });
  const [pendingMessage, setPendingMessage] = useState(null);
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pendingClarification, setPendingClarification] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'

  // Derived active messages for current conversation
  const messages = messagesMap[activeConversation] || [];

  // Refs to avoid stale closures in async handlers
  const activeConversationRef = useRef(activeConversation);
  const agentsRef = useRef(agents);
  const wsHandlersSetup = useRef(false);

  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  // ── Message helpers ───────────────────────────────────────────────────────
  const addMessage = (convId, msg) => {
    setMessagesMap(prev => ({
      ...prev,
      [convId]: [...(prev[convId] || []), msg],
    }));
  };

  const updateLastOrchestratorMessage = (convId, updater) => {
    setMessagesMap(prev => {
      const msgs = prev[convId] || [];
      const lastOrchIdx = msgs.map((m, i) => m.role === 'orchestrator' ? i : -1).filter(i => i >= 0).pop();
      if (lastOrchIdx === undefined) return prev;
      const updated = msgs.map((m, i) => i === lastOrchIdx ? updater(m) : m);
      return { ...prev, [convId]: updated };
    });
  };

  const updateMessages = (convId, updater) => {
    setMessagesMap(prev => ({
      ...prev,
      [convId]: updater(prev[convId] || []),
    }));
  };

  // ── Conversation management ───────────────────────────────────────────────
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

  // ── WebSocket event handlers ──────────────────────────────────────────────
  const setupWebSocketHandlers = (client) => {
    if (wsHandlersSetup.current) return;
    wsHandlersSetup.current = true;

    client.on(EventType.DELEGATE, (event) => {
      const convId = activeConversationRef.current;
      updateLastOrchestratorMessage(convId, (m) => {
        if (!m.isStreaming) return m;
        const delegations = [...(m.delegations || []), {
          agent: event.to_agent_name,
          task: event.reason || 'Processing request',
          status: 'in-progress',
        }];
        return { ...m, delegations, content: `Routing to **${event.to_agent_name}**...` };
      });
    });

    client.on(EventType.THINK, (event) => {
      const convId = activeConversationRef.current;
      updateLastOrchestratorMessage(convId, (m) =>
        m.isStreaming ? { ...m, content: event.reasoning || 'Thinking...' } : m
      );
    });

    client.on(EventType.ACT, (event) => {
      const convId = activeConversationRef.current;
      // Resolve friendly agent name from local agents list
      const agentObj = agentsRef.current.find(a => a.id === event.agent_id);
      const agentName = agentObj?.name || event.agent_id;
      updateLastOrchestratorMessage(convId, (m) => {
        if (!m.isStreaming) return m;
        const delegations = [...(m.delegations || [])];
        // Avoid duplicate entries for the same tool call
        if (!delegations.find(d => d.toolKey === event.tool_name)) {
          delegations.push({
            toolKey: event.tool_name,          // internal key for OBSERVE matching
            agent: agentName,
            task: `Calling ${event.tool_name}`,
            status: 'in-progress',
          });
        }
        return { ...m, delegations };
      });
    });

    // Mark a delegation as completed or failed when its result arrives
    client.on(EventType.OBSERVE, (event) => {
      const convId = activeConversationRef.current;
      updateLastOrchestratorMessage(convId, (m) => {
        if (!m.isStreaming) return m;
        const delegations = (m.delegations || []).map(d =>
          d.toolKey === event.tool_name
            ? {
                ...d,
                status: event.success ? 'completed' : 'error',
                task: `${event.tool_name} · ${event.duration_ms}ms`,
              }
            : d
        );
        return { ...m, delegations };
      });
    });

    client.on(EventType.ANSWER, (event) => {
      const convId = activeConversationRef.current;
      const agent = agentsRef.current.find(a => a.id === event.agent_id) || { name: 'Assistant', icon: '🤖' };

      updateMessages(convId, (msgs) => {
        const updated = msgs.map(m =>
          m.role === 'orchestrator' && m.isStreaming ? { ...m, isStreaming: false } : m
        );
        return [...updated, {
          id: generateMsgId(),
          role: 'agent',
          content: event.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          agentId: event.agent_id || 'assistant',
          agentName: agent.name,
          agentIcon: agent.icon,
          confidence: event.confidence,
          grounded: event.grounded,
          sources: event.sources,
        }];
      });
    });

    client.on(EventType.CLARIFY, (event) => {
      const convId = activeConversationRef.current;
      updateMessages(convId, (msgs) =>
        msgs.map(m =>
          m.role === 'orchestrator' && m.isStreaming
            ? { ...m, isStreaming: false, content: 'I need a bit more context to give you the best answer:' }
            : m
        )
      );
      setPendingClarification({
        queryId: event.query_id,
        questions: event.clarification_questions || [],
        agentId: event.agent_id || 'governance-security',
      });
    });

    client.on(EventType.ERROR, (event) => {
      const convId = activeConversationRef.current;
      updateMessages(convId, (msgs) => {
        const updated = msgs.map(m =>
          m.role === 'orchestrator' && m.isStreaming ? { ...m, isStreaming: false } : m
        );
        return [...updated, {
          id: generateMsgId(),
          role: 'system',
          content: `**Error:** ${event.error || 'An unexpected error occurred. Please try again.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        }];
      });
      setConnectionStatus('error');
    });
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async (content) => {
    const convId = activeConversationRef.current;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add the user message immediately
    const userMsg = { id: generateMsgId(), role: 'user', content, timestamp: ts };
    addMessage(convId, userMsg);

    // Update conversation preview
    setConversations(prev => prev.map(c =>
      c.id === convId && (c.title === 'New Conversation' || c.preview === '')
        ? { ...c, title: content.length > 40 ? content.substring(0, 40) + '…' : content, preview: content.substring(0, 60) }
        : c
    ));

    try {
      const client = getClient();

      if (!client.connected) {
        setConnectionStatus('connecting');
        await client.connect();
        setupWebSocketHandlers(client);
        setConnectionStatus('connected');
      }

      // Add orchestrator thinking indicator
      const thinkingMsg = {
        id: generateMsgId(),
        role: 'orchestrator',
        content: 'Analyzing your request and routing to the appropriate agents...',
        timestamp: ts,
        agentId: 'orchestrator',
        delegations: [],
        isStreaming: true,
      };
      addMessage(convId, thinkingMsg);

      client.sendQuery(content);
    } catch (error) {
      console.error('[AgentContext] Failed to send message:', error);
      setConnectionStatus('error');
      addMessage(convId, {
        id: generateMsgId(),
        role: 'system',
        content: '**Connection error:** Unable to reach the orchestrator. Please check your connection and try again.',
        timestamp: ts,
        isError: true,
      });
    }
  };

  // ── Submit clarification answers ──────────────────────────────────────────
  const submitClarification = (answers) => {
    if (!pendingClarification) return;

    const client = getClient();
    client.sendClarifyResponse(pendingClarification.queryId, answers);

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const convId = activeConversationRef.current;

    addMessage(convId, { id: generateMsgId(), role: 'user', content: answers, timestamp: ts });
    addMessage(convId, {
      id: generateMsgId(),
      role: 'orchestrator',
      content: 'Got it! Searching with your context...',
      timestamp: ts,
      agentId: 'orchestrator',
      delegations: [],
      isStreaming: true,
    });

    setPendingClarification(null);
  };

  // ── Auto-connect on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const client = getClient();
    setConnectionStatus('connecting');
    client.connect()
      .then(() => {
        setupWebSocketHandlers(client);
        setConnectionStatus('connected');
      })
      .catch((err) => {
        console.warn('[AgentContext] Initial connection failed, will retry on first message:', err);
        setConnectionStatus('error');
      });

    return () => {
      wsHandlersSetup.current = false;
      client.disconnect();
    };
  }, []);

  // ── Handle pending messages (set after conversation switch) ───────────────
  useEffect(() => {
    if (!pendingMessage) return;
    const msg = pendingMessage;
    setPendingMessage(null);
    sendMessage(msg);
  }, [pendingMessage]);

  return (
    <AgentContext.Provider
      value={{
        agents,
        setAgents,
        conversations,
        setConversations,
        activeConversation,
        setActiveConversation,
        messages,
        sendMessage,
        createConversation,
        setPendingMessage,
        workflows,
        setWorkflows,
        notifications,
        setNotifications,
        pendingClarification,
        submitClarification,
        connectionStatus,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgentContext must be used within AgentProvider');
  return ctx;
}
