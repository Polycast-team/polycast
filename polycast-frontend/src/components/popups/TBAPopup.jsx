import React from 'react';
import './TBAPopup.css';

const TBAPopup = ({ tba, onClose }) => {
  if (!tba) return null;

  return (
    <div className="tba-popup-overlay" onClick={onClose}>
      <div className="tba-popup" onClick={(e) => e.stopPropagation()}>
        <div className="tba-popup-header">
          <div className="tba-popup-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="tba-popup-title">TBA</h3>
          <button className="tba-popup-close" onClick={onClose}>×</button>
        </div>
        <div className="tba-popup-content">
          <p className="tba-popup-message">{tba}</p>
        </div>
        <div className="tba-popup-actions">
          <button className="tba-popup-button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default TBAPopup;