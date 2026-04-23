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
