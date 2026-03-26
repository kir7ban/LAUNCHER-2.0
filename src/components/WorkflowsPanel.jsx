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
