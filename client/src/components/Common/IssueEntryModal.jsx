import React, { useState } from 'react';
import { X, Send, AlertTriangle, ShieldAlert, Bug, Info } from 'lucide-react';
import './IssueEntryModal.scss';

const IssueEntryModal = ({ isOpen, onClose }) => {
  const [headline, setHeadline] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [environment, setEnvironment] = useState('Production');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Issue Submitted:', { headline, priority, environment, description, steps });
    onClose();
  };

  return (
    <div className="issue-modal-overlay">
      <div className="issue-modal-content">
        <div className="issue-modal-header">
          <div className="header-icon">
            <ShieldAlert size={20} />
            <span>REPORT NEW VULNERABILITY</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="issue-modal-body">
          <div className="form-group">
            <label>Issue Headline</label>
            <input 
              type="text" 
              placeholder="e.g. Broken link in payment footer"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Priority Level</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Environment</label>
              <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Development">Development</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Detailed Description</label>
            <textarea 
              rows="4" 
              placeholder="Explain the impact..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label>Reproduction Steps (One per line)</label>
            <textarea 
              rows="3" 
              placeholder="1. login&#10;2. click..."
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="modal-actions">
            <button type="button" className="discard-btn" onClick={onClose}>Discard</button>
            <button type="submit" className="submit-btn">
              Submit to Internal Team
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueEntryModal;
