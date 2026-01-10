import React from 'react';
import PropTypes from 'prop-types';
import './QuickTranslationTooltip.css';

function QuickTranslationTooltip({ word, translation, position, loading, visible }) {
  if (!visible) return null;

  const style = {
    left: `${position.x}px`,
    top: `${position.y - 10}px`, // 10px above the word
  };

  return (
    <div
      className="quick-translation-tooltip"
      style={style}
      role="tooltip"
      aria-live="polite"
      aria-label={`Translation for ${word}: ${translation || 'loading'}`}
    >
      <div className="tooltip-content">
        <div className="tooltip-word">{word}</div>
        {loading ? (
          <div className="tooltip-loading">
            <div className="loading-spinner-small"></div>
            <span>Loading...</span>
          </div>
        ) : translation ? (
          <div className="tooltip-translation">{translation}</div>
        ) : (
          <div className="tooltip-error">Translation unavailable</div>
        )}
      </div>
    </div>
  );
}

QuickTranslationTooltip.propTypes = {
  word: PropTypes.string.isRequired,
  translation: PropTypes.string,
  position: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
  }).isRequired,
  loading: PropTypes.bool,
  visible: PropTypes.bool.isRequired,
};

export default QuickTranslationTooltip;
