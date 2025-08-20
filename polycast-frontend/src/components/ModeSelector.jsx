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
  ];

  const buttons = [
    {
      mode: 'audio',
      label: ui.classroomMode,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="5" x2="20" y2="5"/>
          <line x1="6" y1="5" x2="6" y2="7"/>
          <line x1="18" y1="5" x2="18" y2="7"/>
          <rect x="6" y="7" width="12" height="8" rx="1.5"/>
          <line x1="12" y1="15" x2="12" y2="20"/>
          <line x1="9" y1="20" x2="15" y2="20"/>
        </svg>
      ),
      colorIndex: 0,
      onClick: () => {
        if (userRole === 'student' && !roomSetup) {
          alert(ui.joinRoomFirst);
          return;
        }
        onModeChange('audio');
      }
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
      mode: 'flashcard',
      label: ui.flashcardMode,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="14" rx="2"/>
          <rect x="5" y="5" width="14" height="10" rx="1"/>
          <line x1="8" y1="8" x2="16" y2="8"/>
          <line x1="8" y1="11" x2="13" y2="11"/>
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
      {/* Bottom Toolbar - All Mode Buttons */}
      <div className="bottom-toolbar">
        <div className="bottom-toolbar-content">
          {buttons.map((button) => {
            const colors = buttonColors[button.colorIndex];
            const isActive = appMode === button.mode;
            
            return (
              <button
                key={button.mode}
                className={`bottom-toolbar-button ${isActive ? 'active' : ''} color-${button.colorIndex}`}
                onClick={button.onClick}
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