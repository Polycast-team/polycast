import React from 'react';
import './TBAPopup.css';

const TBAPopup = ({ tba, onClose }) => {
  if (!tba) return null;

  return (
    <div className="tba-popup-overlay" onClick={onClose}>
      <div className="tba-popup" onClick={(e) => e.stopPropagation()}>
        <div className="tba-popup-header">
          <div className="tba-popup-icon">🚧</div>
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