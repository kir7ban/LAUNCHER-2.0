import React, { useState } from 'react';
import '../styles/ClarificationCard.css';

/**
 * ClarificationCard — shown when the agent needs more information before answering.
 *
 * Props:
 *   questions  - Array of { question, options: [{label, value}], allows_freeform }
 *   onSubmit   - Callback(answers: string) when user submits
 *   agentName  - Display name of the agent asking
 *   agentIcon  - Emoji icon
 */
export default function ClarificationCard({
  questions = [],
  onSubmit,
  agentName = 'Governance & Security',
  agentIcon = '🛡️',
}) {
  const [selectedOptions, setSelectedOptions] = useState({});
  const [freeformAnswers, setFreeformAnswers] = useState({});

  const handleOptionToggle = (qIdx, value) => {
    setSelectedOptions((prev) => ({ ...prev, [qIdx]: value }));
    setFreeformAnswers((prev) => ({ ...prev, [qIdx]: '' }));
  };

  const handleFreeformChange = (qIdx, value) => {
    setFreeformAnswers((prev) => ({ ...prev, [qIdx]: value }));
    if (value) setSelectedOptions((prev) => ({ ...prev, [qIdx]: null }));
  };

  const isSubmittable = questions.length === 0 || questions.every((_, i) =>
    selectedOptions[i] || (freeformAnswers[i] && freeformAnswers[i].trim())
  );

  const handleSubmit = () => {
    if (!isSubmittable) return;
    const parts = questions.map((q, i) => {
      const answer = freeformAnswers[i]?.trim() || selectedOptions[i] || '';
      return answer ? `${q.question}\nAnswer: ${answer}` : null;
    }).filter(Boolean);
    onSubmit(parts.join('\n\n') || 'No specific preference.');
  };

  return (
    <div className="clarification-card">
      <div className="clarification-header">
        <span className="clarification-badge">{agentIcon} {agentName}</span>
        <p className="clarification-subtitle">
          A few quick questions to give you the best answer:
        </p>
      </div>

      <div className="clarification-body">
        {questions.map((q, qIdx) => (
          <div key={qIdx} className="clarification-question">
            <div className="clarification-question-text">{q.question}</div>

            {q.options && q.options.length > 0 && (
              <div className="clarification-options">
                {q.options.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    className={`clarification-option${selectedOptions[qIdx] === opt.value ? ' selected' : ''}`}
                    onClick={() => handleOptionToggle(qIdx, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {q.allows_freeform !== false && (
              <input
                type="text"
                className="clarification-freeform"
                placeholder="Or type your answer..."
                value={freeformAnswers[qIdx] || ''}
                onChange={(e) => handleFreeformChange(qIdx, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && isSubmittable) handleSubmit(); }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="clarification-footer">
        <button
          className="clarification-submit"
          onClick={handleSubmit}
          disabled={!isSubmittable}
        >
          Submit &amp; Continue →
        </button>
      </div>
    </div>
  );
}
