import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import DashboardLanding from './components/DashboardLanding';
import DashboardHeader from './components/DashboardHeader';
import AgentDetailModal from './components/AgentDetailModal';
import AgentPanel from './components/AgentPanel';
import WorkflowsPanel from './components/WorkflowsPanel';
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
            <AgentPanel onSelectAgent={setSelectedAgent} />
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

function App() {
  return (
    <AgentProvider>
      <AppContent />
    </AgentProvider>
  );
}

export default App;
