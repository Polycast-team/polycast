import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import VideoSearch from './VideoSearch.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import TranscriptPanel from './TranscriptPanel.jsx';
import SubtitleDisplay from './SubtitleDisplay.jsx';
import WordDefinitionPopup from '../WordDefinitionPopup.jsx';
import QuickTranslationTooltip from './QuickTranslationTooltip.jsx';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer.js';
import { useSubtitles } from '../../hooks/useSubtitles.js';
import apiService from '../../services/apiService.js';
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
  const [wordDefinition, setWordDefinition] = useState(null);
  const [loadingDefinition, setLoadingDefinition] = useState(false);

  // Hover translation state
  const [hoverState, setHoverState] = useState({
    isVisible: false,
    word: '',
    position: { x: 0, y: 0 },
    translation: null,
    loading: false,
  });
  const [wasPlayingBeforeHover, setWasPlayingBeforeHover] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const hoverAbortControllerRef = useRef(null);

  // Auto-pause feature state
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(() => {
    const saved = localStorage.getItem('learnMode.autoPauseEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const previousSubtitleRef = useRef(null);

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
    play,
    pause,
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

  // Handle word hover for quick translation
  const handleWordHover = useCallback((word, position, contextSentence) => {
    // Don't show hover tooltip if click popup is visible
    if (popupState.isVisible) return;

    const cleanWord = word.toLowerCase();
    const sentence = contextSentence || fullTranscript || '';

    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Debounce: wait 300ms before showing tooltip
    hoverTimeoutRef.current = setTimeout(async () => {
      // Pause video if playing
      if (isPlaying) {
        setWasPlayingBeforeHover(true);
        pause();
      }

      // Show tooltip immediately with loading state
      setHoverState({
        isVisible: true,
        word: cleanWord,
        position,
        translation: null,
        loading: true,
      });

      // Cancel any pending request
      if (hoverAbortControllerRef.current) {
        hoverAbortControllerRef.current.abort();
      }

      // Fetch quick translation
      try {
        hoverAbortControllerRef.current = new AbortController();

        const sentenceWithMarkedWord = sentence.replace(
          new RegExp(`\\b(${word})\\b`, 'gi'),
          (match, index) => index === 0 ? `~${match}~` : match
        );

        const url = apiService.getQuickWordDataUrl(
          cleanWord,
          sentenceWithMarkedWord,
          nativeLanguage || 'English',
          targetLanguage || 'Spanish'
        );

        const response = await fetch(url, {
          signal: hoverAbortControllerRef.current.signal,
        });

        if (response.ok) {
          const data = await response.json();
          setHoverState(prev => ({
            ...prev,
            translation: data.translation || data.contextualExplanation || data.definition,
            loading: false,
          }));
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('[LearnMode] Error fetching hover translation:', error);
          setHoverState(prev => ({
            ...prev,
            translation: null,
            loading: false,
          }));
        }
      }
    }, 300);
  }, [fullTranscript, nativeLanguage, targetLanguage, popupState.isVisible, isPlaying, pause]);

  // Handle word leave (mouse out)
  const handleWordLeave = useCallback(() => {
    // Clear pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Cancel pending request
    if (hoverAbortControllerRef.current) {
      hoverAbortControllerRef.current.abort();
      hoverAbortControllerRef.current = null;
    }

    // Hide tooltip
    setHoverState(prev => ({ ...prev, isVisible: false }));

    // Resume video if it was playing before hover
    if (wasPlayingBeforeHover) {
      play();
      setWasPlayingBeforeHover(false);
    }
  }, [wasPlayingBeforeHover, play]);

  // Handle word click for translation popup
  const handleWordClick = useCallback(async (word, position, contextSentence) => {
    // Close hover tooltip
    setHoverState(prev => ({ ...prev, isVisible: false }));
    setWasPlayingBeforeHover(false); // Don't auto-resume on click

    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    const cleanWord = word.toLowerCase();
    const sentence = contextSentence || fullTranscript || '';

    // Show popup immediately
    setPopupState({
      isVisible: true,
      word: cleanWord,
      position,
      contextSentence: sentence,
    });

    // Reset and start loading
    setWordDefinition(null);
    setLoadingDefinition(true);

    try {
      // Mark the word in the sentence for context
      const sentenceWithMarkedWord = sentence.replace(
        new RegExp(`\\b(${word})\\b`, 'gi'),
        (match, index) => index === 0 ? `~${match}~` : match
      );

      // Fetch definition using quick API
      const url = apiService.getQuickWordDataUrl(
        cleanWord,
        sentenceWithMarkedWord,
        nativeLanguage || 'English',
        targetLanguage || 'Spanish'
      );

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setWordDefinition(data);
      }
    } catch (error) {
      console.error('[LearnMode] Error fetching word definition:', error);
    } finally {
      setLoadingDefinition(false);
    }
  }, [fullTranscript, nativeLanguage, targetLanguage]);

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

  // Cleanup hover timeout and abort controller on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (hoverAbortControllerRef.current) {
        hoverAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-pause when subtitle changes
  useEffect(() => {
    if (!autoPauseEnabled || !currentSubtitle) return;

    // Check if subtitle changed (previous one ended)
    if (previousSubtitleRef.current &&
        previousSubtitleRef.current.index !== currentSubtitle.index) {
      pause();
    }

    previousSubtitleRef.current = currentSubtitle;
  }, [currentSubtitle, autoPauseEnabled, pause]);

  // Persist auto-pause preference to localStorage
  useEffect(() => {
    localStorage.setItem('learnMode.autoPauseEnabled', JSON.stringify(autoPauseEnabled));
  }, [autoPauseEnabled]);

  // Toggle auto-pause
  const handleToggleAutoPause = useCallback(() => {
    setAutoPauseEnabled(prev => !prev);
  }, []);

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
          onWordHover={handleWordHover}
          onWordLeave={handleWordLeave}
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
          autoPauseEnabled={autoPauseEnabled}
          onWordClick={handleWordClick}
          onWordHover={handleWordHover}
          onWordLeave={handleWordLeave}
          onToggleFullscreen={toggleFullscreen}
          onExitFullscreen={exitFullscreen}
          onToggleAutoPause={handleToggleAutoPause}
          onClose={handleCloseVideo}
        />

        {/* Current Subtitle Display (non-fullscreen) */}
        {!isFullscreen && currentSubtitle && (
          <div className="current-subtitle-section">
            <SubtitleDisplay
              subtitle={currentSubtitle}
              onWordClick={handleWordClick}
              onWordHover={handleWordHover}
              onWordLeave={handleWordLeave}
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

      {/* Quick Translation Tooltip (Hover) */}
      <QuickTranslationTooltip
        word={hoverState.word}
        translation={hoverState.translation}
        position={hoverState.position}
        loading={hoverState.loading}
        visible={hoverState.isVisible}
      />

      {/* Word Definition Popup (Click) */}
      {popupState.isVisible && (
        <WordDefinitionPopup
          word={popupState.word}
          definition={wordDefinition}
          position={popupState.position}
          loading={loadingDefinition}
          nativeLanguage={nativeLanguage || 'English'}
          onClose={handlePopupClose}
          onAddToDictionary={() => handleAddWordToDictionary(popupState.word)}
          onRemoveFromDictionary={() => {}}
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
