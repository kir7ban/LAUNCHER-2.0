import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { processMessage, MessageQueue, generateMsgId } from '../services/mockOrchestrator';

const AgentContext = createContext();

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
    description: 'Provides daily menu information, meal pre-ordering, dietary preferences management, and cafeteria feedback.',
    capabilities: ['Menu Display', 'Meal Pre-Order', 'Dietary Filters', 'Feedback Collection'],
    tasksCompleted: 3420,
    avgResponseTime: '0.3s',
    successRate: '99.4%',
    model: 'GPT-4o',
    lastActive: 'Just now',
    logs: [
      { time: '10:00:00', message: 'Daily menu updated for all cafeterias', type: 'info' },
      { time: '10:15:00', message: '45 meal pre-orders confirmed for lunch', type: 'success' },
    ],
  },
  {
    id: 'employee-onboarding',
    name: 'Employee Guided Onboarding',
    icon: '🎓',
    status: 'active',
    description: 'Guides new joiners through the onboarding process, documentation, training schedules, and team introductions.',
    capabilities: ['Onboarding Checklist', 'Document Collection', 'Training Scheduling', 'Buddy Assignment'],
    tasksCompleted: 645,
    avgResponseTime: '1.2s',
    successRate: '98.2%',
    model: 'GPT-4o',
    lastActive: '5 min ago',
    logs: [
      { time: '09:00:00', message: 'New joiner onboarding initiated for 3 employees', type: 'info' },
      { time: '09:30:00', message: 'Document verification completed', type: 'success' },
    ],
  },
  {
    id: 'triage-process',
    name: 'Triage Process',
    icon: '🔀',
    status: 'active',
    description: 'Classifies, prioritizes, and routes incoming requests or tickets to the appropriate teams or agents.',
    capabilities: ['Request Classification', 'Priority Assignment', 'Smart Routing', 'SLA Monitoring'],
    tasksCompleted: 4120,
    avgResponseTime: '0.2s',
    successRate: '99.6%',
    model: 'GPT-4o',
    lastActive: 'Just now',
    logs: [
      { time: '10:32:05', message: 'Incoming ticket classified as Facility issue', type: 'info' },
      { time: '10:32:06', message: 'Routed to Facility & IT Support agent', type: 'success' },
    ],
  },
  {
    id: 'visitor-management',
    name: 'Visitor Management',
    icon: '🏢',
    status: 'idle',
    description: 'Handles visitor pre-registration, gate pass generation, host notifications, and check-in/check-out tracking.',
    capabilities: ['Pre-Registration', 'Gate Pass Generation', 'Host Notification', 'Visit Tracking'],
    tasksCompleted: 890,
    avgResponseTime: '0.7s',
    successRate: '98.8%',
    model: 'GPT-4o',
    lastActive: '15 min ago',
    logs: [
      { time: '10:15:00', message: 'Gate pass generated for 2 visitors', type: 'success' },
      { time: '10:15:01', message: 'Host notified via email and Teams', type: 'info' },
    ],
  },
  {
    id: 'retiral-benefits',
    name: 'Retiral Benefits',
    icon: '🏦',
    status: 'idle',
    description: 'Provides information on provident fund, gratuity, pension plans, and retirement benefit calculations.',
    capabilities: ['PF Balance Inquiry', 'Gratuity Calculator', 'Pension Planning', 'Benefit Statements'],
    tasksCompleted: 312,
    avgResponseTime: '1.5s',
    successRate: '99.0%',
    model: 'GPT-4o',
    lastActive: '20 min ago',
    logs: [
      { time: '10:10:00', message: 'PF balance query processed for employee', type: 'success' },
      { time: '10:12:00', message: 'Gratuity estimate calculated', type: 'success' },
    ],
  },
  {
    id: 'facility-it-support',
    name: 'Facility & IT Support',
    icon: '🔧',
    status: 'active',
    description: 'Manages IT helpdesk tickets, facility maintenance requests, asset provisioning, and infrastructure issues.',
    capabilities: ['Ticket Creation', 'Asset Management', 'Maintenance Requests', 'Troubleshooting'],
    tasksCompleted: 2780,
    avgResponseTime: '0.9s',
    successRate: '97.5%',
    model: 'GPT-4o',
    lastActive: '2 min ago',
    logs: [
      { time: '10:30:00', message: 'IT ticket #4521 resolved - VPN access restored', type: 'success' },
      { time: '10:31:00', message: 'Facility request: AC repair in Block B, Floor 3', type: 'info' },
    ],
  },
];

const initialConversations = [
  { id: 'conv-1', title: 'Internet Reimbursement Claim', timestamp: 'Today 10:30 AM', preview: 'Claim my internet reimb...' },
  { id: 'conv-2', title: 'Canteen Menu Today', timestamp: 'Today 9:15 AM', preview: 'What is the lunch menu...' },
  { id: 'conv-3', title: 'IT Ticket - VPN Issue', timestamp: 'Yesterday', preview: 'My VPN is not connecting...' },
  { id: 'conv-4', title: 'Book a Cab for Tomorrow', timestamp: 'Yesterday', preview: 'I need a cab pickup at...' },
  { id: 'conv-5', title: 'New Joiner Onboarding', timestamp: 'Mar 23', preview: 'Guide me through the...' },
];

const initialMessages = [
  {
    id: 'msg-init-1',
    role: 'user',
    content: 'Claim my internet reimbursement for March.',
    timestamp: '10:30 AM',
  },
  {
    id: 'msg-init-2',
    role: 'orchestrator',
    content: "I'll process your internet reimbursement claim for March. Let me coordinate with the relevant agents:\n\n1. **Internet Reimbursement** → Validate claim details and policy\n2. **EzyClaim** → Submit and route the claim for approval\n3. **Triage Process** → Assign priority and track SLA\n\nStarting the workflow now...",
    timestamp: '10:30 AM',
    agentId: 'orchestrator',
    delegations: [
      { agent: 'Internet Reimbursement', task: 'Validate claim & policy check', status: 'completed' },
      { agent: 'EzyClaim', task: 'Submit claim for approval', status: 'completed' },
      { agent: 'Triage Process', task: 'Assign priority & track SLA', status: 'completed' },
    ],
  },
  {
    id: 'msg-init-3',
    role: 'agent',
    content: '**Claim Validated:** Your internet reimbursement for March has been verified. Monthly allowance: Rs.1,500. Receipt amount matches the policy limit. Claim is eligible for processing.',
    timestamp: '10:31 AM',
    agentId: 'internet-reimbursement',
    agentName: 'Internet Reimbursement',
    agentIcon: '🌐',
  },
  {
    id: 'msg-init-4',
    role: 'agent',
    content: '**Claim Submitted:**\n\n- **Claim ID:** EC-2025-03-4821\n- **Amount:** Rs.1,500\n- **Category:** Internet / Broadband\n- **Status:** Sent to manager for approval\n\nYou will receive an email notification once approved. Typical processing time: 2-3 business days.',
    timestamp: '10:31 AM',
    agentId: 'ezyclaim',
    agentName: 'EzyClaim',
    agentIcon: '📋',
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

export function AgentProvider({ children }) {
  const [agents, setAgents] = useState(initialAgents);
  const [conversations, setConversations] = useState([
    { id: 'conv-new', title: 'New Conversation', timestamp: 'Just now', preview: '' },
    ...initialConversations,
  ]);
  const [activeConversation, setActiveConversation] = useState('conv-new');
  const [messagesMap, setMessagesMap] = useState({
    'conv-new': [],
    'conv-1': [...initialMessages],
  });
  const [pendingMessage, setPendingMessage] = useState(null);
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [conversationStates, setConversationStates] = useState({});

  // Derived active messages
  const messages = messagesMap[activeConversation] || [];

  // Refs to avoid stale closures in async pipeline
  const messageQueueRef = useRef(new MessageQueue());
  const activeConversationRef = useRef(activeConversation);
  const conversationStatesRef = useRef(conversationStates);

  useEffect(() => { activeConversationRef.current = activeConversation; }, [activeConversation]);
  useEffect(() => { conversationStatesRef.current = conversationStates; }, [conversationStates]);

  const addMessage = (convId, msg) => {
    setMessagesMap(prev => ({
      ...prev,
      [convId]: [...(prev[convId] || []), msg],
    }));
  };

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

  const sendMessage = (content) => {
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

    // Process through mock orchestrator
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

  return (
    <AgentContext.Provider
      value={{
        agents, setAgents,
        conversations, setConversations,
        activeConversation, setActiveConversation,
        messages,
        sendMessage,
        createConversation,
        workflows, setWorkflows,
        notifications, setNotifications,
        pendingMessage, setPendingMessage,
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
