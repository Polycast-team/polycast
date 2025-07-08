import React from 'react';
import './ErrorPopup.css';

const ErrorPopup = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="error-popup-overlay" onClick={onClose}>
      <div className="error-popup" onClick={(e) => e.stopPropagation()}>
        <div className="error-popup-header">
          <div className="error-popup-icon">⚠️</div>
          <h3 className="error-popup-title">Error</h3>
          <button className="error-popup-close" onClick={onClose}>×</button>
        </div>
        <div className="error-popup-content">
          <p className="error-popup-message">{error}</p>
        </div>
        <div className="error-popup-actions">
          <button className="error-popup-button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorPopup;