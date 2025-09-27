import React from 'react';
import PropTypes from 'prop-types';
import { getUITranslationsForProfile } from '../utils/profileLanguageMapping';

function ModeSelector({ 
  appMode, 
  onModeChange, 
  userRole, 
  roomSetup, 
  selectedProfile 
}) {
  const ui = getUITranslationsForProfile(selectedProfile);

  const buttonColors = [
    { base: '#dc2626', hover: '#ef4444', active: '#b91c1c' }, // Red
    { base: '#16a34a', hover: '#22c55e', active: '#15803d' }, // Green  
    { base: '#2563eb', hover: '#3b82f6', active: '#1d4ed8' }, // Blue
    { base: '#8b5cf6', hover: '#a78bfa', active: '#7c3aed' }, // Purple
    { base: '#0f9f96', hover: '#14b8a6', active: '#0d9488' }, // Teal
  ];

  const buttons = [
    {
      mode: 'ai',
      label: ui.aiMode || 'AI',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c3 0 7 2 7 6.5 0 3-2.4 5.5-5.2 5.5h-.8L12 21l-1-6H10c-2.8 0-5.2-2.5-5.2-5.5C4.8 5 9 3 12 3z" />
          <circle cx="9" cy="9.5" r="1" />
          <circle cx="15" cy="9.5" r="1" />
          <path d="M9.5 13.2c.9.9 2.1 1.3 3.5 1.3s2.6-.4 3.5-1.3" />
        </svg>
      ),
      colorIndex: 4,
      onClick: () => onModeChange('ai')
    },
    {
      mode: 'dictionary',
      label: ui.dictionaryMode,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2"/>
          <line x1="12" y1="5" x2="12" y2="19"/>
          <path d="M5 9 C6 8.7 7 9.3 8 9" strokeWidth="1"/>
          <path d="M5 11 C6 10.7 7 11.3 8 11" strokeWidth="1"/>
          <path d="M5 13 C6 12.7 7 13.3 8 13" strokeWidth="1"/>
          <path d="M16 9 C17 8.7 18 9.3 19 9" strokeWidth="1"/>
          <path d="M16 11 C17 10.7 18 11.3 19 11" strokeWidth="1"/>
          <path d="M16 13 C17 12.7 18 13.3 19 13" strokeWidth="1"/>
        </svg>
      ),
      colorIndex: 1,
      onClick: () => onModeChange('dictionary')
    },
    {
      mode: 'audio',
      label: ui.classroomMode,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M5 20c0-4 3-7 7-7s7 3 7 7"/>
        </svg>
      ),
      colorIndex: 0,
      onClick: () => {
        if (userRole === 'student' && !roomSetup) {
          window.dispatchEvent(new CustomEvent('openJoinRoom'));
          return;
        }
        onModeChange('audio');
      }
    },
    {
      mode: 'flashcard',
      label: ui.flashcardMode,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20l-7 1 1-7L15.5 4.5a2.121 2.121 0 0 1 3 0l1 1a2.121 2.121 0 0 1 0 3L12 20z"/>
          <path d="M16 5l3 3"/>
        </svg>
      ),
      colorIndex: 2,
      onClick: () => onModeChange('flashcard')
    },
    {
      mode: 'video',
      label: ui.video,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="12" height="12" rx="2"/>
          <polygon points="17,10 21,8 21,16 17,14"/>
        </svg>
      ),
      colorIndex: 3,
      onClick: () => onModeChange('video')
    }
  ];

  return (
    <>
      <div className="bottom-toolbar" id="pc-bottom-toolbar">
        <div className="bottom-toolbar-content">
          {buttons.map((button) => {
            const colors = buttonColors[button.colorIndex];
            const isActive = appMode === button.mode;
            
            return (
              <button
                key={button.mode}
                className={`bottom-toolbar-button ${isActive ? 'active' : ''} color-${button.colorIndex}`}
                onClick={button.onClick}
                style={{
                  color: isActive ? colors.active : colors.base
                }}
              >
                {button.icon}
                <span>{button.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

ModeSelector.propTypes = {
  appMode: PropTypes.string.isRequired,
  onModeChange: PropTypes.func.isRequired,
  userRole: PropTypes.string,
  roomSetup: PropTypes.object,
  selectedProfile: PropTypes.string.isRequired,
};

export default ModeSelector;
