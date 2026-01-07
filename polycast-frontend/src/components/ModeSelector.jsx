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
    { base: '#14b8a6', hover: '#2dd4bf', active: '#0f766e' }, // Teal
    { base: '#8b5cf6', hover: '#a78bfa', active: '#7c3aed' }, // Purple
    { base: '#f59e0b', hover: '#fbbf24', active: '#d97706' }, // Amber (Learn)
  ];

  const buttons = [
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
      colorIndex: 0,
      onClick: () => onModeChange('dictionary')
    },
    {
      mode: 'audio',
      label: ui.classroomMode,
      icon: (
        // Silhouette (head + torso) icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/>
          <path d="M5 20c0-4 3-7 7-7s7 3 7 7"/>
        </svg>
      ),
      colorIndex: 1,
      onClick: () => {
        if (userRole === 'student' && !roomSetup) {
          // Open join room modal instead of alert
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
        // Diagonal pencil icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20l-7 1 1-7L15.5 4.5a2.121 2.121 0 0 1 3 0l1 1a2.121 2.121 0 0 1 0 3L12 20z"/>
          <path d="M16 5l3 3"/>
        </svg>
      ),
      colorIndex: 2,
      onClick: () => onModeChange('flashcard')
    },
    {
      mode: 'ai',
      label: ui.aiMode || 'AI Mode',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 5h10a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-2.5L9 20v-4H7a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" />
          <path d="M9 9h6" strokeWidth="1.6" />
          <path d="M9 12h4" strokeWidth="1.6" />
          <path d="M17.5 3.5l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z" strokeWidth="1.4" />
        </svg>
      ),
      colorIndex: 3,
      onClick: () => onModeChange('ai')
    },
    {
      mode: 'learn',
      label: ui.learnMode || 'Learn',
      icon: (
        // YouTube play button icon
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="3"/>
          <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/>
        </svg>
      ),
      colorIndex: 5,
      onClick: () => onModeChange('learn')
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
      colorIndex: 4,
      onClick: () => onModeChange('video')
    }
  ];

  return (
    <>
      {/* Bottom Toolbar - All Mode Buttons */}
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
