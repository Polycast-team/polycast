import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import VideoSearch from './VideoSearch.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import TranscriptPanel from './TranscriptPanel.jsx';
import SubtitleDisplay from './SubtitleDisplay.jsx';
import WordDefinitionPopup from '../WordDefinitionPopup.jsx';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer.js';
import { useSubtitles } from '../../hooks/useSubtitles.js';
import './LearnMode.css';

function LearnMode({
  targetLanguage,
  nativeLanguage,
  selectedProfile,
  onAddWord,
  wordDefinitions,
}) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [popupState, setPopupState] = useState({
    isVisible: false,
    word: '',
    position: { x: 0, y: 0 },
    contextSentence: '',
  });

  // Subtitle management
  const {
    subtitles,
    isLoading: subtitlesLoading,
    error: subtitlesError,
    currentIndex,
    currentSubtitle,
    fullTranscript,
    fetchSubtitles,
    updateCurrentSubtitle,
    clearSubtitles,
  } = useSubtitles(selectedVideo?.videoId, targetLanguage);

  // YouTube player management
  const handleTimeUpdate = useCallback((time) => {
    updateCurrentSubtitle(time);
  }, [updateCurrentSubtitle]);

  const {
    containerRef,
    isReady,
    isPlaying,
    isFullscreen,
    seekTo,
    toggleFullscreen,
    exitFullscreen,
  } = useYouTubePlayer(selectedVideo?.videoId, handleTimeUpdate);

  // Fetch subtitles when video is selected
  useEffect(() => {
    if (selectedVideo?.videoId) {
      fetchSubtitles(selectedVideo.videoId, targetLanguage);
    } else {
      clearSubtitles();
    }
  }, [selectedVideo?.videoId, targetLanguage, fetchSubtitles, clearSubtitles]);

  // Handle video selection
  const handleVideoSelect = useCallback((video) => {
    setSelectedVideo(video);
    setPopupState(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Handle closing the video player
  const handleCloseVideo = useCallback(() => {
    setSelectedVideo(null);
    clearSubtitles();
    setPopupState(prev => ({ ...prev, isVisible: false }));
  }, [clearSubtitles]);

  // Handle word click for translation popup
  const handleWordClick = useCallback((word, position, contextSentence) => {
    setPopupState({
      isVisible: true,
      word: word.toLowerCase(),
      position,
      contextSentence: contextSentence || fullTranscript,
    });
  }, [fullTranscript]);

  // Handle popup close
  const handlePopupClose = useCallback(() => {
    setPopupState(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Handle adding word to dictionary
  const handleAddWordToDictionary = useCallback(async (word) => {
    if (onAddWord) {
      await onAddWord(word);
    }
    handlePopupClose();
  }, [onAddWord, handlePopupClose]);

  // Check if word is already in dictionary
  const isWordInDictionary = useCallback((word) => {
    if (!wordDefinitions) return false;
    const wordLower = word.toLowerCase();
    return Object.values(wordDefinitions).some(
      entry => entry?.word?.toLowerCase() === wordLower && entry?.inFlashcards
    );
  }, [wordDefinitions]);

  // If no video selected, show search
  if (!selectedVideo) {
    return (
      <div className="learn-mode">
        <div className="learn-mode-header">
          <h2>Learn with Videos</h2>
          <p>Search for videos in {targetLanguage || 'your target language'} with subtitles</p>
        </div>
        <VideoSearch
          targetLanguage={targetLanguage}
          onVideoSelect={handleVideoSelect}
        />
      </div>
    );
  }

  // Video player view
  return (
    <div className={`learn-mode with-video ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* Left Panel: Transcript (hidden in fullscreen) */}
      {!isFullscreen && (
        <TranscriptPanel
          subtitles={subtitles}
          currentIndex={currentIndex}
          onSeek={seekTo}
          onWordClick={handleWordClick}
          isLoading={subtitlesLoading}
          error={subtitlesError}
        />
      )}

      {/* Right Panel: Video Player */}
      <div className="video-section">
        <VideoPlayer
          containerRef={containerRef}
          isReady={isReady}
          isPlaying={isPlaying}
          isFullscreen={isFullscreen}
          currentSubtitle={currentSubtitle}
          videoTitle={selectedVideo.title}
          onWordClick={handleWordClick}
          onToggleFullscreen={toggleFullscreen}
          onExitFullscreen={exitFullscreen}
          onClose={handleCloseVideo}
        />

        {/* Current Subtitle Display (non-fullscreen) */}
        {!isFullscreen && currentSubtitle && (
          <div className="current-subtitle-section">
            <SubtitleDisplay
              subtitle={currentSubtitle}
              onWordClick={handleWordClick}
              isOverlay={false}
            />
          </div>
        )}

        {/* Video Info */}
        {!isFullscreen && (
          <div className="video-meta">
            <p>{selectedVideo.channelTitle}</p>
          </div>
        )}
      </div>

      {/* Word Definition Popup */}
      {popupState.isVisible && (
        <WordDefinitionPopup
          word={popupState.word}
          position={popupState.position}
          contextSentence={popupState.contextSentence}
          targetLanguage={targetLanguage}
          nativeLanguage={nativeLanguage}
          selectedProfile={selectedProfile}
          onClose={handlePopupClose}
          onAddWord={handleAddWordToDictionary}
          isInDictionary={isWordInDictionary(popupState.word)}
        />
      )}
    </div>
  );
}

LearnMode.propTypes = {
  targetLanguage: PropTypes.string,
  nativeLanguage: PropTypes.string,
  selectedProfile: PropTypes.string,
  onAddWord: PropTypes.func,
  wordDefinitions: PropTypes.object,
};

export default LearnMode;
