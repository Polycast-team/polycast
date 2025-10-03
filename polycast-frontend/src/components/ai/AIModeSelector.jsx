import React from 'react';
import PropTypes from 'prop-types';
import { getUITranslationsForProfile } from '../../utils/profileLanguageMapping';
import './AIModeSelector.css';

function AIModeSelector({ 
  isOpen, 
  onClose, 
  onSelectMode, 
  selectedProfile 
}) {
  const ui = getUITranslationsForProfile(selectedProfile);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="ai-mode-selector-overlay" onClick={handleOverlayClick}>
      <div className="ai-mode-selector-modal">
        <div className="ai-mode-selector-header">
          <h2>{ui?.aiMode || 'AI Mode'}</h2>
          <button 
            className="ai-mode-selector-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <div className="ai-mode-selector-options">
          <button
            className="ai-mode-option"
            onClick={() => onSelectMode('chatting')}
          >
            <div className="ai-mode-option-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <path d="M8 9h8"/>
                <path d="M8 13h6"/>
              </svg>
            </div>
            <div className="ai-mode-option-content">
              <h3>{ui?.aiChatting || 'Chatting'}</h3>
              <p>{ui?.aiChattingDescription || 'Have a conversation with Polycast AI'}</p>
            </div>
          </button>

          <button
            className="ai-mode-option"
            onClick={() => onSelectMode('sentence-practice')}
          >
            <div className="ai-mode-option-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10,9 9,9 8,9"/>
              </svg>
            </div>
            <div className="ai-mode-option-content">
              <h3>{ui?.aiSentencePractice || 'Sentence Practice'}</h3>
              <p>{ui?.aiSentencePracticeDescription || 'Practice translating sentences'}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

AIModeSelector.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelectMode: PropTypes.func.isRequired,
  selectedProfile: PropTypes.string.isRequired,
};

export default AIModeSelector;
