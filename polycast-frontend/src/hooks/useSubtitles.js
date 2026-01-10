import { useState, useCallback, useMemo } from 'react';
import apiService from '../services/apiService.js';

/**
 * Hook for managing video subtitles
 * Handles fetching, parsing, and syncing subtitles with video playback
 */
export function useSubtitles(videoId, language = null) {
  const [subtitles, setSubtitles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Fetch subtitles for a video
  const fetchSubtitles = useCallback(async (newVideoId = videoId, newLanguage = language) => {
    if (!newVideoId) {
      setSubtitles([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentIndex(-1);

    try {
      const data = await apiService.getVideoSubtitles(newVideoId, newLanguage);
      setSubtitles(data.subtitles || []);
      console.log(`[Subtitles] Loaded ${data.subtitles?.length || 0} subtitle segments`);
    } catch (err) {
      console.error('[Subtitles] Error fetching:', err);
      setError(err.message || 'Failed to load subtitles');
      setSubtitles([]);
    } finally {
      setIsLoading(false);
    }
  }, [videoId, language]);

  // Update current subtitle based on playback time
  const updateCurrentSubtitle = useCallback((currentTime) => {
    if (!subtitles.length) {
      setCurrentIndex(-1);
      return null;
    }

    // Find the subtitle with the most recent start time <= currentTime
    // This handles overlapping subtitles correctly (common in auto-generated captions)
    let index = -1;
    for (let i = 0; i < subtitles.length; i++) {
      if (subtitles[i].start <= currentTime) {
        index = i;
      } else {
        break; // Subtitles are sorted by start time, so we can stop here
      }
    }

    if (index !== -1 && index !== currentIndex) {
      console.log('[useSubtitles] Current subtitle updated to index:', index, 'at time:', currentTime.toFixed(1));
    }

    setCurrentIndex(index);
    return index >= 0 ? subtitles[index] : null;
  }, [subtitles, currentIndex]);

  // Get current subtitle
  const currentSubtitle = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < subtitles.length) {
      return subtitles[currentIndex];
    }
    return null;
  }, [subtitles, currentIndex]);

  // Get previous subtitle
  const previousSubtitle = useMemo(() => {
    if (currentIndex > 0) {
      return subtitles[currentIndex - 1];
    }
    return null;
  }, [subtitles, currentIndex]);

  // Get next subtitle
  const nextSubtitle = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < subtitles.length - 1) {
      return subtitles[currentIndex + 1];
    }
    return null;
  }, [subtitles, currentIndex]);

  // Get subtitle at specific index
  const getSubtitleAt = useCallback((index) => {
    if (index >= 0 && index < subtitles.length) {
      return subtitles[index];
    }
    return null;
  }, [subtitles]);

  // Parse subtitle text into clickable words
  const parseSubtitleWords = useCallback((text) => {
    if (!text) return [];

    // Split by whitespace but preserve punctuation attached to words
    const words = text.split(/\s+/).filter(Boolean);

    return words.map((word, index) => {
      // Extract the actual word (without leading/trailing punctuation)
      const match = word.match(/^([^\w]*)(\w+)([^\w]*)$/);
      if (match) {
        return {
          full: word,
          prefix: match[1] || '',
          word: match[2],
          suffix: match[3] || '',
          index,
        };
      }
      return {
        full: word,
        prefix: '',
        word: word,
        suffix: '',
        index,
      };
    });
  }, []);

  // Get full transcript text
  const fullTranscript = useMemo(() => {
    return subtitles.map(sub => sub.text).join(' ');
  }, [subtitles]);

  // Clear subtitles
  const clearSubtitles = useCallback(() => {
    setSubtitles([]);
    setCurrentIndex(-1);
    setError(null);
  }, []);

  return {
    subtitles,
    isLoading,
    error,
    currentIndex,
    currentSubtitle,
    previousSubtitle,
    nextSubtitle,
    fullTranscript,
    fetchSubtitles,
    updateCurrentSubtitle,
    getSubtitleAt,
    parseSubtitleWords,
    clearSubtitles,
  };
}
