import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import SubtitleDisplay from './SubtitleDisplay.jsx';
import './LearnMode.css';

function VideoPlayer({
  containerRef,
  isReady,
  isPlaying,
  isFullscreen,
  currentSubtitle,
  videoTitle,
  onWordClick,
  onToggleFullscreen,
  onExitFullscreen,
  onClose,
}) {
  // Handle escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        onExitFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onExitFullscreen]);

  return (
    <div className={`video-player-container ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* Video Controls Header */}
      <div className="video-player-header">
        <button
          className="video-control-button"
          onClick={onClose}
          title="Close video"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        {videoTitle && (
          <span className="video-header-title" title={videoTitle}>
            {videoTitle}
          </span>
        )}

        <div className="video-header-actions">
          <button
            className="video-control-button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* YouTube Player */}
      <div className="youtube-player-wrapper">
        <div ref={containerRef} className="youtube-player"></div>

        {!isReady && (
          <div className="video-loading-overlay">
            <div className="loading-spinner"></div>
            <span>Loading video...</span>
          </div>
        )}
      </div>

      {/* Subtitle Overlay (shown in fullscreen) */}
      {isFullscreen && currentSubtitle && (
        <div className="subtitle-overlay">
          <SubtitleDisplay
            subtitle={currentSubtitle}
            onWordClick={onWordClick}
            isOverlay={true}
          />
        </div>
      )}
    </div>
  );
}

VideoPlayer.propTypes = {
  containerRef: PropTypes.object.isRequired,
  isReady: PropTypes.bool.isRequired,
  isPlaying: PropTypes.bool.isRequired,
  isFullscreen: PropTypes.bool.isRequired,
  currentSubtitle: PropTypes.shape({
    text: PropTypes.string,
    start: PropTypes.number,
    end: PropTypes.number,
  }),
  videoTitle: PropTypes.string,
  onWordClick: PropTypes.func.isRequired,
  onToggleFullscreen: PropTypes.func.isRequired,
  onExitFullscreen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default VideoPlayer;
