import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import DashboardHeader from './components/DashboardHeader';
import AgentDetailModal from './components/AgentDetailModal';
import AgentPanel from './components/AgentPanel';
import WorkflowsPanel from './components/WorkflowsPanel';
import BoschHeader from './components/BoschHeader';
import BoschFooter from './components/BoschFooter';
import BdogenieBackground from 'react-bdogenie-bg';
import LandingPage from './components/LandingPage';
import { AgentProvider, useAgentContext } from './context/AgentContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/App.css';

function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 768);
  const [activeView, setActiveView] = useState('landing');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [transition, setTransition] = useState('');       // '' | 'exit' | 'enter'
  const [pendingQuery, setPendingQuery] = useState(null);  // query waiting for transition
  const { agents, sendMessage, createConversation, setPendingMessage } = useAgentContext();

  const transitionToChat = (query) => {
    setPendingQuery(query);
    setTransition('exit');
  };

  // When exit animation ends, switch view and start enter animation
  useEffect(() => {
    if (transition !== 'exit') return;
    const timer = setTimeout(() => {
      // Create conversation but don't send yet — pendingQuery stays until chat mounts
      if (pendingQuery) {
        createConversation(pendingQuery.length > 30 ? pendingQuery.slice(0, 30) + '…' : pendingQuery);
      }
      setActiveView('chat');
      setTransition('enter');
    }, 300);
    return () => clearTimeout(timer);
  }, [transition]);

  // After chat view enters, send the pending query
  useEffect(() => {
    if (transition !== 'enter') return;
    if (pendingQuery) {
      setPendingMessage(pendingQuery);
      setPendingQuery(null);
    }
    const timer = setTimeout(() => setTransition(''), 300);
    return () => clearTimeout(timer);
  }, [transition]);

  if (activeView === 'landing') {
    return (
      <div className={`app ${transition === 'exit' ? 'app-transition-exit' : ''}`}>
        <BdogenieBackground />
        <BoschHeader />
        <LandingPage
          onSendQuery={transitionToChat}
        />
      </div>
    );
  }

  return (
    <div className={`app ${transition === 'enter' ? 'app-transition-enter' : ''}`}>
      <BdogenieBackground />
      <BoschHeader />
      <div className="app-body">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeView={activeView}
          onViewChange={setActiveView}
          onSelectAgent={setSelectedAgent}
        />
        <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <DashboardHeader
            activeView={activeView}
          />
          <div className="content-area">
          {(activeView === 'dashboard' || activeView === 'chat') && (
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
    <ThemeProvider>
      <AgentProvider>
        <AppContent />
      </AgentProvider>
    </ThemeProvider>
  );
}

export default App;
