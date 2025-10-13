import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';

const DictionarySearchPopup = ({ isOpen, initialValue, onApply, onClose }) => {
  const [term, setTerm] = useState(initialValue || '');
  const inputRef = useRef(null);
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 0); }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div className="tba-popup-overlay" onClick={onClose}>
      <div className="tba-popup" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="tba-popup-header">
          <div className="tba-popup-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>
          <h3 className="tba-popup-title">Search Dictionary</h3>
          <button className="tba-popup-close" onClick={onClose}>×</button>
        </div>
        <div className="tba-popup-content">
          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search words..."
            style={{ width: '100%' }}
          />
        </div>
        <div className="tba-popup-actions">
          <button className="tba-popup-button" onClick={() => { onApply(term); onClose(); }}>Apply</button>
        </div>
      </div>
    </div>
  );
};

DictionarySearchPopup.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  initialValue: PropTypes.string,
  onApply: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default DictionarySearchPopup;


