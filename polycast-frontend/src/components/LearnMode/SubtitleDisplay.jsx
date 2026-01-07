import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import './LearnMode.css';

function SubtitleDisplay({ subtitle, onWordClick, isOverlay = false }) {
  // Parse subtitle text into clickable word tokens
  const wordTokens = useMemo(() => {
    if (!subtitle?.text) return [];

    const text = subtitle.text;
    const tokens = [];
    let currentIndex = 0;

    // Match words and non-word sequences
    const regex = /(\S+)(\s*)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const word = match[1];
      const trailing = match[2] || '';

      // Check if this is primarily punctuation or a real word
      const isWord = /\w/.test(word);

      tokens.push({
        id: currentIndex,
        full: fullMatch,
        word: word,
        trailing: trailing,
        isClickable: isWord,
        // Extract clean word (letters/numbers only) for dictionary lookup
        cleanWord: word.replace(/[^\w]/g, '').toLowerCase(),
      });

      currentIndex++;
    }

    return tokens;
  }, [subtitle?.text]);

  const handleWordClick = useCallback((e, token) => {
    if (!token.isClickable || !token.cleanWord) return;

    e.stopPropagation();

    // Get click position for popup placement
    const rect = e.target.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };

    onWordClick(token.cleanWord, position, subtitle.text);
  }, [onWordClick, subtitle?.text]);

  if (!subtitle?.text) {
    return null;
  }

  return (
    <div className={`subtitle-display ${isOverlay ? 'overlay' : ''}`}>
      <p className="subtitle-text">
        {wordTokens.map((token) => (
          <React.Fragment key={token.id}>
            {token.isClickable ? (
              <span
                className="clickable-word"
                onClick={(e) => handleWordClick(e, token)}
                role="button"
                tabIndex={0}
              >
                {token.word}
              </span>
            ) : (
              <span className="non-word">{token.word}</span>
            )}
            {token.trailing && <span className="whitespace">{token.trailing}</span>}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

SubtitleDisplay.propTypes = {
  subtitle: PropTypes.shape({
    text: PropTypes.string,
    start: PropTypes.number,
    end: PropTypes.number,
    index: PropTypes.number,
  }),
  onWordClick: PropTypes.func.isRequired,
  isOverlay: PropTypes.bool,
};

export default SubtitleDisplay;
