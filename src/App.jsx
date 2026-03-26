import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import DashboardLanding from './components/DashboardLanding';
import DashboardHeader from './components/DashboardHeader';
import AgentDetailModal from './components/AgentDetailModal';
import BoschHeader from './components/BoschHeader';
import BoschFooter from './components/BoschFooter';
import InteractiveBackground from './components/InteractiveBackground';
import { AgentProvider, useAgentContext } from './context/AgentContext';
import './styles/App.css';

function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const { agents, sendMessage, createConversation, setPendingMessage } = useAgentContext();

  return (
    <div className="app">
      <InteractiveBackground />
      <BoschHeader />
      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeView={activeView}
          onViewChange={setActiveView}
        />
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <DashboardHeader
            activeView={activeView}
            onViewChange={setActiveView}
            onSelectAgent={setSelectedAgent}
          />
          <div className="content-area">
          {activeView === 'dashboard' && (
            <DashboardLanding
              onNavigate={(view) => setActiveView(view)}
              onSelectAgent={setSelectedAgent}
            />
          )}
          {activeView === 'chat' && (
            <div className="split-view">
              <ChatPanel />
            </div>
          )}
          {activeView === 'agents' && (
            <div className="agents-grid-view">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`agent-card-large status-${agent.status}`}
                  onClick={() => setSelectedAgent(agent)}
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
            </div>
          )}
          {activeView === 'workflows' && (
            <div className="workflows-view">
              <WorkflowsPanel />
            </div>
          )}
          </div>
          <BoschFooter />
        </div>
      </div>
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onNavigateToChat={(agentName) => {
            setSelectedAgent(null);
            setActiveView('chat');
            createConversation('Task for ' + agentName);
            setPendingMessage('I need help from ' + agentName);
          }}
        />
      )}
    </div>
  );
}

function WorkflowsPanel() {
  const workflows = [
    { id: 1, name: 'Customer Support Pipeline', steps: 4, status: 'active', lastRun: '2 min ago', agents: ['Researcher', 'Writer', 'Reviewer'] },
    { id: 2, name: 'Data Analysis Flow', steps: 3, status: 'idle', lastRun: '1 hr ago', agents: ['Data Analyst', 'Researcher'] },
    { id: 3, name: 'Content Generation', steps: 5, status: 'active', lastRun: '5 min ago', agents: ['Writer', 'Reviewer', 'Publisher'] },
    { id: 4, name: 'Code Review Pipeline', steps: 3, status: 'error', lastRun: '30 min ago', agents: ['Code Agent', 'Reviewer'] },
  ];

  return (
    <div className="workflows-container">
      <div className="workflows-header">
        <h2>Workflow Orchestrations</h2>
        <button className="btn-primary">+ New Workflow</button>
      </div>
      <div className="workflows-list">
        {workflows.map((wf) => (
          <div key={wf.id} className={`workflow-card status-${wf.status}`}>
            <div className="workflow-card-top">
              <h3>{wf.name}</h3>
              <span className={`status-badge ${wf.status}`}>{wf.status}</span>
            </div>
            <div className="workflow-meta">
              <span>🔗 {wf.steps} steps</span>
              <span>⏱️ {wf.lastRun}</span>
            </div>
            <div className="workflow-agents">
              {wf.agents.map((a, i) => (
                <span key={i} className="workflow-agent-chip">{a}</span>
              ))}
            </div>
            <div className="workflow-actions">
              <button className="btn-sm btn-outline">View</button>
              <button className="btn-sm btn-primary">Run</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <AgentProvider>
      <AppContent />
    </AgentProvider>
  );
}

export default App;
