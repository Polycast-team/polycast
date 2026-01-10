import React, { useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import './LearnMode.css';

function TranscriptPanel({
  subtitles,
  currentIndex,
  onSeek,
  onWordClick,
  onWordHover,
  onWordLeave,
  isLoading,
  error,
}) {
  const containerRef = useRef(null);
  const currentItemRef = useRef(null);

  // Auto-scroll to current subtitle within transcript container only
  useEffect(() => {
    if (currentItemRef.current && containerRef.current) {
      const container = containerRef.current.querySelector('.transcript-list');
      const item = currentItemRef.current;

      if (container && item) {
        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();

        // Check if item is outside visible area
        if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
          // Scroll within container only, not the whole window
          const scrollTop = item.offsetTop - container.offsetTop - (container.clientHeight / 2) + (item.clientHeight / 2);
          container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentIndex]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }, []);

  const handleWordClick = useCallback((e, word, subtitleText) => {
    console.log('[TranscriptPanel] Word clicked:', word);
    e.stopPropagation();
    e.preventDefault();

    const rect = e.target.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };

    console.log('[TranscriptPanel] Calling onWordClick with:', { word, position, subtitleText });
    onWordClick(word, position, subtitleText);
  }, [onWordClick]);

  const handleWordHover = useCallback((e, word, subtitleText) => {
    if (!onWordHover) return;

    const rect = e.target.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };

    onWordHover(word, position, subtitleText);
  }, [onWordHover]);

  const handleWordLeave = useCallback(() => {
    if (onWordLeave) {
      onWordLeave();
    }
  }, [onWordLeave]);

  const renderClickableText = useCallback((text, subtitleText) => {
    const tokens = [];
    const regex = /(\S+)(\s*)/g;
    let match;
    let index = 0;

    while ((match = regex.exec(text)) !== null) {
      const word = match[1];
      const trailing = match[2] || '';
      const isWord = /\w/.test(word);
      const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();

      if (isWord && cleanWord) {
        tokens.push(
          <span
            key={index}
            className="transcript-word"
            onClick={(e) => {
              console.log('[TranscriptPanel] CLICK EVENT FIRED for word:', cleanWord);
              handleWordClick(e, cleanWord, subtitleText);
            }}
            onMouseDown={(e) => {
              console.log('[TranscriptPanel] MOUSEDOWN EVENT for word:', cleanWord);
              e.stopPropagation();
            }}
            onMouseUp={(e) => {
              console.log('[TranscriptPanel] MOUSEUP EVENT for word:', cleanWord);
            }}
            onMouseEnter={(e) => handleWordHover(e, cleanWord, subtitleText)}
            onMouseLeave={handleWordLeave}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'inline-block',
              position: 'relative',
              zIndex: 10
            }}
          >
            {word}
          </span>
        );
      } else {
        tokens.push(<span key={index}>{word}</span>);
      }

      if (trailing) {
        tokens.push(<span key={`space-${index}`}>{trailing}</span>);
      }

      index++;
    }

    return tokens;
  }, [handleWordClick, handleWordHover, handleWordLeave]);

  if (isLoading) {
    return (
      <div className="transcript-panel">
        <div className="transcript-loading">
          <div className="loading-spinner"></div>
          <span>Loading transcript...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transcript-panel">
        <div className="transcript-error">
          {error}
        </div>
      </div>
    );
  }

  if (!subtitles || subtitles.length === 0) {
    return (
      <div className="transcript-panel">
        <div className="transcript-empty">
          No transcript available
        </div>
      </div>
    );
  }

  return (
    <div className="transcript-panel" ref={containerRef}>
      <div className="transcript-header">
        <h3>Transcript</h3>
        <span className="transcript-count">{subtitles.length} segments</span>
      </div>

      <div className="transcript-list">
        {subtitles.map((subtitle, index) => {
          const isCurrent = index === currentIndex;

          return (
            <div
              key={subtitle.index}
              ref={isCurrent ? currentItemRef : null}
              className={`transcript-item ${isCurrent ? 'current' : ''}`}
            >
              <span
                className="transcript-time"
                onClick={() => onSeek(subtitle.start)}
                style={{ cursor: 'pointer' }}
              >
                {formatTime(subtitle.start)}
              </span>
              <span className="transcript-text">
                {renderClickableText(subtitle.text, subtitle.text)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

TranscriptPanel.propTypes = {
  subtitles: PropTypes.arrayOf(PropTypes.shape({
    index: PropTypes.number,
    text: PropTypes.string,
    start: PropTypes.number,
    end: PropTypes.number,
  })),
  currentIndex: PropTypes.number,
  onSeek: PropTypes.func.isRequired,
  onWordClick: PropTypes.func.isRequired,
  onWordHover: PropTypes.func,
  onWordLeave: PropTypes.func,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
};

export default TranscriptPanel;
