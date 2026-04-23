import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getClient, api, EventType } from '../services/orchestratorClient';

const AgentContext = createContext();

// Feature flag for using real backend vs mock
const USE_REAL_BACKEND = import.meta.env.VITE_USE_REAL_BACKEND === 'true';


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

export function AgentProvider({ children }) {
  const [agents, setAgents] = useState(initialAgents);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversation, setActiveConversation] = useState('conv-1');
  const [pendingClarification, setPendingClarification] = useState(null);
  // Shape: { queryId: string, questions: array, agentId: string } | null

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'user',
      content: 'Claim my internet reimbursement for March.',
      timestamp: '10:30 AM',
    },
    {
      id: 2,
      role: 'orchestrator',
      content: "I'll process your internet reimbursement claim for March. Let me coordinate with the relevant agents:\n\n1. **Internet Reimbursement** → Validate claim details and policy\n2. **EzyClaim** → Submit and route the claim for approval\n3. **Triage Process** → Assign priority and track SLA\n\nStarting the workflow now...",
      timestamp: '10:30 AM',
      agentId: 'orchestrator',
      delegations: [
        { agent: 'Internet Reimbursement', task: 'Validate claim & policy check', status: 'completed' },
        { agent: 'EzyClaim', task: 'Submit claim for approval', status: 'completed' },
        { agent: 'Triage Process', task: 'Assign priority & track SLA', status: 'in-progress' },
      ],
    },
    {
      id: 3,
      role: 'agent',
      content: '**Claim Validated:** Your internet reimbursement for March has been verified. Monthly allowance: ₹1,500. Receipt amount matches the policy limit. Claim is eligible for processing.',
      timestamp: '10:31 AM',
      agentId: 'internet-reimbursement',
      agentName: 'Internet Reimbursement',
      agentIcon: '🌐',
    },
    {
      id: 4,
      role: 'agent',
      content: '**Claim Submitted:**\n\n- **Claim ID:** EC-2025-03-4821\n- **Amount:** ₹1,500\n- **Category:** Internet / Broadband\n- **Status:** Sent to manager for approval\n\nYou will receive an email notification once approved. Typical processing time: 2–3 business days.',
      timestamp: '10:31 AM',
      agentId: 'ezyclaim',
      agentName: 'EzyClaim',
      agentIcon: '📋',
    },
  ]);

  const sendMessage = (content) => {
    const userMsg = {
      id: messages.length + 1,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    if (USE_REAL_BACKEND) {
      // Real backend: use WebSocket streaming
      sendToBackend(content, userMsg.id);
    } else {
      // Mock mode: simulate responses
      simulateMockResponse(content);
    }
  };

  // Send to real backend via WebSocket
  const sendToBackend = async (content, userMsgId) => {
    try {
      const client = getClient();
      
      // Ensure connected
      if (!client.connected) {
        await client.connect();
        setupWebSocketHandlers(client);
      }

      // Add orchestrator thinking message
      const thinkingMsg = {
        id: userMsgId + 1,
        role: 'orchestrator',
        content: 'Analyzing your request and routing to the appropriate agents...',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agentId: 'orchestrator',
        delegations: [],
        isStreaming: true,
      };
      setMessages((prev) => [...prev, thinkingMsg]);

      // Send query
      client.sendQuery(content);
    } catch (error) {
      console.error('Failed to send to backend:', error);
      // Fallback to mock
      simulateMockResponse(content);
    }
  };

  const submitClarification = (answers) => {
    if (!pendingClarification) return;

    const client = getClient();
    client.sendClarifyResponse(pendingClarification.queryId, answers);

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: 'user',
        content: answers,
        timestamp: ts,
      },
      {
        id: Date.now() + 1,
        role: 'orchestrator',
        content: 'Got it! Searching with your context...',
        timestamp: ts,
        agentId: 'orchestrator',
        delegations: [],
        isStreaming: true,
      },
    ]);

    setPendingClarification(null);
  };

  // Setup WebSocket event handlers
  const setupWebSocketHandlers = (client) => {
    client.on(EventType.DELEGATE, (event) => {
      setMessages((prev) => {
        const lastOrch = prev.findLast(m => m.role === 'orchestrator');
        if (lastOrch && lastOrch.isStreaming) {
          const delegations = [...(lastOrch.delegations || [])];
          delegations.push({
            agent: event.to_agent_name,
            task: event.reason || 'Processing request',
            status: 'in-progress',
          });
          return prev.map(m => m.id === lastOrch.id 
            ? { ...m, delegations, content: `Routing to **${event.to_agent_name}**...` }
            : m
          );
        }
        return prev;
      });
    });

    client.on(EventType.THINK, (event) => {
      setMessages((prev) => {
        const lastOrch = prev.findLast(m => m.role === 'orchestrator' && m.isStreaming);
        if (lastOrch) {
          return prev.map(m => m.id === lastOrch.id 
            ? { ...m, content: event.reasoning || 'Thinking...' }
            : m
          );
        }
        return prev;
      });
    });

    client.on(EventType.ACT, (event) => {
      setMessages((prev) => {
        const lastOrch = prev.findLast(m => m.role === 'orchestrator');
        if (lastOrch && lastOrch.isStreaming) {
          const delegations = [...(lastOrch.delegations || [])];
          // Update to show tool being called
          const existing = delegations.find(d => d.agent.toLowerCase().includes(event.agent_id));
          if (!existing) {
            delegations.push({
              agent: event.agent_id,
              task: `Calling ${event.tool_name}`,
              status: 'in-progress',
            });
          }
          return prev.map(m => m.id === lastOrch.id 
            ? { ...m, delegations }
            : m
          );
        }
        return prev;
      });
    });

    client.on(EventType.ANSWER, (event) => {
      // Find the agent info
      const agent = agents.find(a => a.id === event.agent_id) || {
        name: 'Assistant',
        icon: '🤖',
      };

      setMessages((prev) => {
        // Mark orchestrator message as done
        const updated = prev.map(m => 
          m.role === 'orchestrator' && m.isStreaming 
            ? { ...m, isStreaming: false }
            : m
        );

        // Add the final answer
        const answerMsg = {
          id: Date.now(),
          role: 'agent',
          content: event.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          agentId: event.agent_id || 'assistant',
          agentName: agent.name,
          agentIcon: agent.icon,
          confidence: event.confidence,
          grounded: event.grounded,
          sources: event.sources,
        };

        return [...updated, answerMsg];
      });
    });

    client.on(EventType.CLARIFY, (event) => {
      // Stop the streaming orchestrator indicator
      setMessages((prev) =>
        prev.map((m) =>
          m.role === 'orchestrator' && m.isStreaming
            ? {
                ...m,
                isStreaming: false,
                content: 'I need a bit more context to give you the best answer:',
              }
            : m
        )
      );
      // Store pending clarification
      setPendingClarification({
        queryId: event.query_id,
        questions: event.clarification_questions || [],
        agentId: event.agent_id || 'governance-security',
      });
    });

    client.on(EventType.ERROR, (event) => {
      setMessages((prev) => {
        const updated = prev.map(m => 
          m.role === 'orchestrator' && m.isStreaming 
            ? { ...m, isStreaming: false }
            : m
        );

        const errorMsg = {
          id: Date.now(),
          role: 'system',
          content: `**Error:** ${event.error}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        };

        return [...updated, errorMsg];
      });
    });
  };

  // Mock response simulation (for testing without backend)
  const simulateMockResponse = (content) => {
    // Simulate orchestrator response
    setTimeout(() => {
      const orchMsg = {
        id: messages.length + 2,
        role: 'orchestrator',
        content: `Got it! I'm analyzing your request and routing it to the right agents...\n\nI'll delegate this to the **Triage Process** agent for classification and the appropriate service agent for resolution.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agentId: 'orchestrator',
        delegations: [
          { agent: 'Triage Process', task: 'Classify & route request', status: 'in-progress' },
          { agent: 'Facility & IT Support', task: 'Process service request', status: 'pending' },
        ],
      };
      setMessages((prev) => [...prev, orchMsg]);
    }, 800);

    // Simulate agent response
    setTimeout(() => {
      const agentMsg = {
        id: messages.length + 3,
        role: 'agent',
        content: `I've classified your request and routed it to the appropriate agent. The task has been assigned and is being processed.\n\nYou'll receive a confirmation shortly with the reference number and expected resolution time.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        agentId: 'triage-process',
        agentName: 'Triage Process',
        agentIcon: '🔀',
      };
      setMessages((prev) => [...prev, agentMsg]);
    }, 2500);
  };

  return (
    <AgentContext.Provider
      value={{
        agents,
        setAgents,
        conversations,
        activeConversation,
        setActiveConversation,
        messages,
        sendMessage,
        pendingClarification,
        submitClarification,
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
